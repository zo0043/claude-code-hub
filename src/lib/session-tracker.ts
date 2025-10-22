import { getRedisClient } from './redis';

/**
 * Session 追踪器 - 统一管理活跃 Session 集合
 *
 * 核心功能：
 * 1. 使用 Sorted Set (ZSET) 管理 session 生命周期（基于时间戳）
 * 2. 自动清理过期 session（5 分钟无活动）
 * 3. 验证 session:${sessionId}:info 是否存在（双重保障）
 * 4. 兼容旧格式（Set）实现零停机迁移
 *
 * 数据结构：
 * - global:active_sessions (ZSET): score = timestamp, member = sessionId
 * - key:${keyId}:active_sessions (ZSET): 同上
 * - provider:${providerId}:active_sessions (ZSET): 同上
 */
export class SessionTracker {
  private static readonly SESSION_TTL = 300000; // 5 分钟（毫秒）

  /**
   * 追踪 session（添加到全局和 key 级集合）
   *
   * 调用时机：SessionGuard 分配 sessionId 后
   *
   * @param sessionId - Session ID
   * @param keyId - API Key ID
   */
  static async trackSession(sessionId: string, keyId: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;

    try {
      const now = Date.now();
      const pipeline = redis.pipeline();

      // 添加到全局集合（ZSET）
      pipeline.zadd('global:active_sessions', now, sessionId);
      pipeline.expire('global:active_sessions', 3600); // 1 小时兜底 TTL

      // 添加到 key 级集合（ZSET）
      pipeline.zadd(`key:${keyId}:active_sessions`, now, sessionId);
      pipeline.expire(`key:${keyId}:active_sessions`, 3600);

      await pipeline.exec();
      console.debug(`[SessionTracker] Tracked session: ${sessionId} (key=${keyId})`);
    } catch (error) {
      console.error('[SessionTracker] Failed to track session:', error);
    }
  }

  /**
   * 更新 session 的 provider 信息（同时刷新时间戳）
   *
   * 调用时机：ProviderResolver 选择 provider 后
   *
   * @param sessionId - Session ID
   * @param providerId - Provider ID
   */
  static async updateProvider(sessionId: string, providerId: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;

    try {
      const now = Date.now();
      const pipeline = redis.pipeline();

      // 更新全局集合时间戳
      pipeline.zadd('global:active_sessions', now, sessionId);

      // 添加到 provider 级集合（ZSET）
      pipeline.zadd(`provider:${providerId}:active_sessions`, now, sessionId);
      pipeline.expire(`provider:${providerId}:active_sessions`, 3600);

      await pipeline.exec();
      console.debug(`[SessionTracker] Updated provider: ${sessionId} → ${providerId}`);
    } catch (error) {
      console.error('[SessionTracker] Failed to update provider:', error);
    }
  }

  /**
   * 刷新 session 时间戳（滑动窗口）
   *
   * 调用时机：响应完成时
   *
   * @param sessionId - Session ID
   * @param keyId - API Key ID
   * @param providerId - Provider ID
   */
  static async refreshSession(
    sessionId: string,
    keyId: number,
    providerId: number
  ): Promise<void> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;

    try {
      const now = Date.now();
      const pipeline = redis.pipeline();

      // 更新所有相关 ZSET 的时间戳（滑动窗口）
      pipeline.zadd('global:active_sessions', now, sessionId);
      pipeline.zadd(`key:${keyId}:active_sessions`, now, sessionId);
      pipeline.zadd(`provider:${providerId}:active_sessions`, now, sessionId);

      await pipeline.exec();
      console.debug(`[SessionTracker] Refreshed session: ${sessionId}`);
    } catch (error) {
      console.error('[SessionTracker] Failed to refresh session:', error);
    }
  }

  /**
   * 获取全局活跃 session 计数
   *
   * 自动兼容新旧格式（ZSET/Set）
   *
   * @returns 活跃 session 数量
   */
  static async getGlobalSessionCount(): Promise<number> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return 0;

    try {
      const key = 'global:active_sessions';
      const exists = await redis.exists(key);

      if (exists === 1) {
        const type = await redis.type(key);

        if (type === 'zset') {
          // 新格式：从 ZSET 读取
          return await this.countFromZSet(key);
        } else {
          // 旧格式：从 Set 读取（兼容模式）
          console.debug('[SessionTracker] Using legacy Set format (will expire in 5 min)');
          return await this.countFromSet(key);
        }
      }

      return 0;
    } catch (error) {
      console.error('[SessionTracker] Failed to get global session count:', error);
      return 0; // Fail Open
    }
  }

  /**
   * 获取 Key 级活跃 session 计数
   *
   * @param keyId - API Key ID
   * @returns 活跃 session 数量
   */
  static async getKeySessionCount(keyId: number): Promise<number> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return 0;

    try {
      const key = `key:${keyId}:active_sessions`;
      const exists = await redis.exists(key);

      if (exists === 1) {
        const type = await redis.type(key);

        if (type === 'zset') {
          return await this.countFromZSet(key);
        } else {
          console.debug(`[SessionTracker] Key ${keyId}: Using legacy Set format`);
          return await this.countFromSet(key);
        }
      }

      return 0;
    } catch (error) {
      console.error('[SessionTracker] Failed to get key session count:', error);
      return 0;
    }
  }

  /**
   * 获取 Provider 级活跃 session 计数
   *
   * @param providerId - Provider ID
   * @returns 活跃 session 数量
   */
  static async getProviderSessionCount(providerId: number): Promise<number> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return 0;

    try {
      const key = `provider:${providerId}:active_sessions`;
      const exists = await redis.exists(key);

      if (exists === 1) {
        const type = await redis.type(key);

        if (type === 'zset') {
          return await this.countFromZSet(key);
        } else {
          console.debug(`[SessionTracker] Provider ${providerId}: Using legacy Set format`);
          return await this.countFromSet(key);
        }
      }

      return 0;
    } catch (error) {
      console.error('[SessionTracker] Failed to get provider session count:', error);
      return 0;
    }
  }

  /**
   * 获取活跃 session ID 列表（用于详情页）
   *
   * @returns Session ID 数组
   */
  static async getActiveSessions(): Promise<string[]> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return [];

    try {
      const key = 'global:active_sessions';
      const exists = await redis.exists(key);

      if (exists === 1) {
        const type = await redis.type(key);

        if (type === 'zset') {
          // 新格式：从 ZSET 读取
          const now = Date.now();
          const fiveMinutesAgo = now - this.SESSION_TTL;

          // 清理过期 session
          await redis.zremrangebyscore(key, '-inf', fiveMinutesAgo);

          // 获取剩余的 session ID
          return await redis.zrange(key, 0, -1);
        } else {
          // 旧格式：从 Set 读取
          return await redis.smembers(key);
        }
      }

      return [];
    } catch (error) {
      console.error('[SessionTracker] Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * 从 ZSET 计数（新格式）
   *
   * 实现步骤：
   * 1. ZREMRANGEBYSCORE 清理过期 session（5 分钟前）
   * 2. ZRANGE 获取剩余 session ID
   * 3. 批量 EXISTS 验证 session:${sessionId}:info 是否存在
   * 4. 统计真实存在的 session
   *
   * @param key - Redis key
   * @returns 有效 session 数量
   */
  private static async countFromZSet(key: string): Promise<number> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return 0;

    try {
      const now = Date.now();
      const fiveMinutesAgo = now - this.SESSION_TTL;

      // 1. 清理过期 session（5 分钟前）
      await redis.zremrangebyscore(key, '-inf', fiveMinutesAgo);

      // 2. 获取剩余的 session ID
      const sessionIds = await redis.zrange(key, 0, -1);
      if (sessionIds.length === 0) return 0;

      // 3. 批量验证 info 是否存在
      const pipeline = redis.pipeline();
      for (const sessionId of sessionIds) {
        pipeline.exists(`session:${sessionId}:info`);
      }
      const results = await pipeline.exec();
      if (!results) return 0;

      // 4. 统计有效 session
      let count = 0;
      for (const result of results) {
        if (result && result[0] === null && result[1] === 1) {
          count++;
        }
      }

      console.debug(
        `[SessionTracker] ZSET ${key}: ${count} valid sessions (from ${sessionIds.length} total)`
      );
      return count;
    } catch (error) {
      console.error('[SessionTracker] Failed to count from ZSET:', error);
      return 0;
    }
  }

  /**
   * 从 Set 计数（旧格式 - 兼容模式）
   *
   * 实现步骤：
   * 1. SMEMBERS 获取所有 session ID
   * 2. 批量 EXISTS 验证 session:${sessionId}:info 是否存在
   * 3. 统计真实存在的 session
   *
   * 注意：这是兼容旧数据的方法，5 分钟后旧数据自动过期，将全部切换到 ZSET
   *
   * @param key - Redis key
   * @returns 有效 session 数量
   */
  private static async countFromSet(key: string): Promise<number> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return 0;

    try {
      // 1. 获取所有 session ID
      const sessionIds = await redis.smembers(key);
      if (sessionIds.length === 0) return 0;

      // 2. 批量验证 info 是否存在
      const pipeline = redis.pipeline();
      for (const sessionId of sessionIds) {
        pipeline.exists(`session:${sessionId}:info`);
      }
      const results = await pipeline.exec();
      if (!results) return 0;

      // 3. 统计有效 session
      let count = 0;
      for (const result of results) {
        if (result && result[0] === null && result[1] === 1) {
          count++;
        }
      }

      console.debug(
        `[SessionTracker] Set ${key} (legacy): ${count} valid sessions (from ${sessionIds.length} total)`
      );
      return count;
    } catch (error) {
      console.error('[SessionTracker] Failed to count from Set:', error);
      return 0;
    }
  }
}
