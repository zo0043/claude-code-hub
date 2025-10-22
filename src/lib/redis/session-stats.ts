import { getRedisClient } from './client';

/**
 * 获取当前活跃的并发 session 数量
 *
 * 统计最近 5 分钟内的活跃 session（基于 Redis TTL）
 * session key 格式：session:{sessionId}:last_seen
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

    let cursor = '0';
    let count = 0;
    const pattern = 'session:*:last_seen';

    do {
      // 使用 SCAN 避免阻塞
      const result = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );

      cursor = result[0];
      count += result[1].length;

      // 如果没有更多键，退出循环
      if (cursor === '0') break;
    } while (true);

    return count;
  } catch (error) {
    console.error('[SessionStats] Failed to get concurrent sessions:', error);
    return 0; // Fail Open
  }
}
