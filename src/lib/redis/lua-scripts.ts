/**
 * Redis Lua 脚本集合
 *
 * 用于保证 Redis 操作的原子性
 */

/**
 * 原子性检查并发限制 + 追踪 Session
 *
 * 功能：
 * 1. 清理过期 session（5 分钟前）
 * 2. 检查当前并发数是否超限
 * 3. 如果未超限，追踪新 session（原子操作）
 *
 * KEYS[1]: provider:${providerId}:active_sessions
 * ARGV[1]: sessionId
 * ARGV[2]: limit（并发限制）
 * ARGV[3]: now（当前时间戳，毫秒）
 *
 * 返回值：
 * - {1, newCount} - 允许（追踪成功），返回新的并发数
 * - {0, currentCount} - 拒绝（超限），返回当前并发数
 */
export const CHECK_AND_TRACK_SESSION = `
local provider_key = KEYS[1]
local session_id = ARGV[1]
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = 300000  -- 5 分钟（毫秒）

-- 1. 清理过期 session（5 分钟前）
local five_minutes_ago = now - ttl
redis.call('ZREMRANGEBYSCORE', provider_key, '-inf', five_minutes_ago)

-- 2. 获取当前并发数
local current_count = redis.call('ZCARD', provider_key)

-- 3. 检查限制
if limit > 0 and current_count >= limit then
  return {0, current_count}  -- {allowed=false, current_count}
end

-- 4. 追踪 session（原子操作）
redis.call('ZADD', provider_key, now, session_id)
redis.call('EXPIRE', provider_key, 3600)  -- 1 小时兜底 TTL

-- 5. 返回成功（新的并发数 = current_count + 1）
return {1, current_count + 1}  -- {allowed=true, new_count}
`;

/**
 * 批量检查多个供应商的并发限制
 *
 * KEYS: provider:${providerId}:active_sessions (多个)
 * ARGV[1]: sessionId
 * ARGV[2...]: limits（每个供应商的并发限制）
 * ARGV[N]: now（当前时间戳，毫秒）
 *
 * 返回值：数组，每个元素对应一个供应商
 * - {1, count} - 允许
 * - {0, count} - 拒绝（超限）
 */
export const BATCH_CHECK_SESSION_LIMITS = `
local session_id = ARGV[1]
local now = tonumber(ARGV[#ARGV])
local ttl = 300000  -- 5 分钟（毫秒）
local five_minutes_ago = now - ttl

local results = {}

-- 遍历所有供应商 key
for i = 1, #KEYS do
  local provider_key = KEYS[i]
  local limit = tonumber(ARGV[i + 1])  -- ARGV[2]...ARGV[N-1]

  -- 清理过期 session
  redis.call('ZREMRANGEBYSCORE', provider_key, '-inf', five_minutes_ago)

  -- 获取当前并发数
  local current_count = redis.call('ZCARD', provider_key)

  -- 检查限制
  if limit > 0 and current_count >= limit then
    table.insert(results, {0, current_count})  -- 拒绝
  else
    table.insert(results, {1, current_count})  -- 允许
  end
end

return results
`;
