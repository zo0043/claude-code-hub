import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  const isEnabled = process.env.ENABLE_RATE_LIMIT === 'true';

  if (!isEnabled || !redisUrl) {
    console.warn('[Redis] Rate limiting disabled or REDIS_URL not configured');
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis(redisUrl, {
      enableOfflineQueue: false, // 快速失败
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          console.error('[Redis] Max retries reached, giving up');
          return null; // 停止重试，降级
        }
        const delay = Math.min(times * 200, 2000);
        console.warn(`[Redis] Retry ${times}/5 after ${delay}ms`);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      console.info('[Redis] Connected successfully');
    });

    redisClient.on('error', (error) => {
      console.error('[Redis] Connection error:', error);
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
