import { getRedisClient } from '@/lib/redis';

interface CostLimit {
  amount: number | null;
  period: '5h' | 'weekly' | 'monthly';
  name: string;
}

export class RateLimitService {
  private static redis = getRedisClient();

  /**
   * 检查金额限制（Key 或 Provider）
   */
  static async checkCostLimits(
    id: number,
    type: 'key' | 'provider',
    limits: {
      limit_5h_usd: number | null;
      limit_weekly_usd: number | null;
      limit_monthly_usd: number | null;
    }
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.redis) {
      // Fail Open：Redis 不可用，放行请求
      return { allowed: true };
    }

    const costLimits: CostLimit[] = [
      { amount: limits.limit_5h_usd, period: '5h', name: '5小时' },
      { amount: limits.limit_weekly_usd, period: 'weekly', name: '周' },
      { amount: limits.limit_monthly_usd, period: 'monthly', name: '月' },
    ];

    try {
      // 使用 Pipeline 批量查询（性能优化）
      const pipeline = this.redis.pipeline();
      for (const limit of costLimits) {
        if (!limit.amount || limit.amount <= 0) continue;
        pipeline.get(`${type}:${id}:cost_${limit.period}`);
      }

      const results = await pipeline.exec();
      if (!results) return { allowed: true };

      let index = 0;
      for (const limit of costLimits) {
        if (!limit.amount || limit.amount <= 0) continue;

        const [err, value] = results[index] || [];
        if (err) {
          console.error(`[RateLimit] Redis error:`, err);
          return { allowed: true }; // Fail Open
        }

        const current = parseFloat((value as string) || '0');
        if (current >= limit.amount) {
          return {
            allowed: false,
            reason: `${type === 'key' ? 'Key' : '供应商'} ${limit.name}消费上限已达到（${current.toFixed(4)}/${limit.amount}）`,
          };
        }

        index++;
      }

      return { allowed: true };
    } catch (error) {
      console.error('[RateLimit] Check failed:', error);
      return { allowed: true }; // Fail Open
    }
  }

  /**
   * 检查并发 Session 限制
   */
  static async checkSessionLimit(
    id: number,
    type: 'key' | 'provider',
    limit: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.redis || limit <= 0) {
      return { allowed: true };
    }

    try {
      const count = await this.redis.scard(`${type}:${id}:active_sessions`);
      if (count >= limit) {
        return {
          allowed: false,
          reason: `${type === 'key' ? 'Key' : '供应商'}并发 Session 上限已达到（${count}/${limit}）`,
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[RateLimit] Session check failed:', error);
      return { allowed: true }; // Fail Open
    }
  }

  /**
   * 累加消费（请求结束后调用）
   */
  static async trackCost(
    keyId: number,
    providerId: number,
    sessionId: string,
    cost: number
  ): Promise<void> {
    if (!this.redis || cost <= 0) return;

    try {
      const pipeline = this.redis.pipeline();

      // 1. 累加 Key 消费
      pipeline.incrbyfloat(`key:${keyId}:cost_5h`, cost);
      pipeline.expire(`key:${keyId}:cost_5h`, 5 * 3600); // 5小时

      pipeline.incrbyfloat(`key:${keyId}:cost_weekly`, cost);
      pipeline.expire(`key:${keyId}:cost_weekly`, 7 * 24 * 3600); // 7天

      pipeline.incrbyfloat(`key:${keyId}:cost_monthly`, cost);
      pipeline.expire(`key:${keyId}:cost_monthly`, 31 * 24 * 3600); // 31天

      // 2. 累加 Provider 消费
      pipeline.incrbyfloat(`provider:${providerId}:cost_5h`, cost);
      pipeline.expire(`provider:${providerId}:cost_5h`, 5 * 3600);

      pipeline.incrbyfloat(`provider:${providerId}:cost_weekly`, cost);
      pipeline.expire(`provider:${providerId}:cost_weekly`, 7 * 24 * 3600);

      pipeline.incrbyfloat(`provider:${providerId}:cost_monthly`, cost);
      pipeline.expire(`provider:${providerId}:cost_monthly`, 31 * 24 * 3600);

      // 3. 追踪 Session
      const ttl = parseInt(process.env.SESSION_TTL || '300');

      pipeline.sadd(`key:${keyId}:active_sessions`, sessionId);
      pipeline.expire(`key:${keyId}:active_sessions`, ttl);

      pipeline.sadd(`provider:${providerId}:active_sessions`, sessionId);
      pipeline.expire(`provider:${providerId}:active_sessions`, ttl);

      pipeline.setex(`session:${sessionId}:last_seen`, ttl, Date.now().toString());
      pipeline.setex(`session:${sessionId}:key`, ttl, keyId.toString());
      pipeline.setex(`session:${sessionId}:provider`, ttl, providerId.toString());

      await pipeline.exec();
    } catch (error) {
      console.error('[RateLimit] Track cost failed:', error);
      // 不抛出错误，静默失败
    }
  }

  /**
   * 获取当前消费（用于响应头）
   */
  static async getCurrentCost(
    id: number,
    type: 'key' | 'provider',
    period: '5h' | 'weekly' | 'monthly'
  ): Promise<number> {
    if (!this.redis) return 0;

    try {
      const value = await this.redis.get(`${type}:${id}:cost_${period}`);
      return parseFloat(value || '0');
    } catch (error) {
      console.error('[RateLimit] Get cost failed:', error);
      return 0;
    }
  }
}
