import { getRedisClient } from './client';

/**
 * 获取当前活跃的并发 session 数量
 *
 * 统计最近 5 分钟内的活跃 session（基于全局 Set + TTL）
 * 使用 global:active_sessions Set 来高效统计
 *
 * @returns 当前并发 session 数量（Redis 不可用时返回 0）
 */
export async function getActiveConcurrentSessions(): Promise<number> {
  const redis = getRedisClient();

  if (!redis) {
    // Redis 未启用，返回 0
    return 0;
  }

  try {
    // 检查 Redis 连接状态
    if (redis.status !== 'ready') {
      console.warn('[SessionStats] Redis not ready, status:', redis.status);
      return 0; // Fail Open
    }

    // 使用 SCARD 获取全局活跃 session 集合的大小
    // 这比 SCAN 所有 key 要高效得多
    const count = await redis.scard('global:active_sessions');
    return count;
  } catch (error) {
    console.error('[SessionStats] Failed to get concurrent sessions:', error);
    return 0; // Fail Open
  }
}
