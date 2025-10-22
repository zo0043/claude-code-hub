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
   * 初始化 SessionTracker，自动清理旧格式数据
   *
   * 应在应用启动时调用一次，清理 global:active_sessions 的旧 Set 数据。
   * 其他 key（provider:*、key:*）在运行时自动清理。
   */
  static async initialize(): Promise<void> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') {
      console.warn('[SessionTracker] Redis not ready, skipping initialization');
      return;
    }

    try {
      const key = 'global:active_sessions';
      const exists = await redis.exists(key);

      if (exists === 1) {
        const type = await redis.type(key);

        if (type !== 'zset') {
          console.warn(`[SessionTracker] Found legacy format: ${key} (type=${type}), deleting...`);
          await redis.del(key);
          console.info(`[SessionTracker] ✅ Deleted legacy ${key}`);
        } else {
          console.debug(`[SessionTracker] ${key} is already ZSET format`);
        }
      } else {
        console.debug(`[SessionTracker] ${key} does not exist, will be created on first use`);
      }
    } catch (error) {
      console.error('[SessionTracker] Initialization failed:', error);
    }
  }

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

      const results = await pipeline.exec();

      // 检查执行结果，捕获类型冲突错误
      if (results) {
        for (const [err] of results) {
          if (err) {
            console.error('[SessionTracker] Pipeline command failed:', err);
            // 如果是类型冲突（WRONGTYPE），自动修复
            if (err.message?.includes('WRONGTYPE')) {
              console.warn('[SessionTracker] Type conflict detected, auto-fixing...');
              await this.initialize(); // 重新初始化，清理旧数据
              return; // 本次追踪失败，下次请求会成功
            }
          }
        }
      }

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

      const results = await pipeline.exec();

      // 检查执行结果，捕获类型冲突错误
      if (results) {
        for (const [err] of results) {
          if (err) {
            console.error('[SessionTracker] Pipeline command failed:', err);
            if (err.message?.includes('WRONGTYPE')) {
              console.warn('[SessionTracker] Type conflict detected, auto-fixing...');
              await this.initialize();
              return;
            }
          }
        }
      }

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

      const results = await pipeline.exec();

      // 检查执行结果，捕获类型冲突错误
      if (results) {
        for (const [err] of results) {
          if (err) {
            console.error('[SessionTracker] Pipeline command failed:', err);
            if (err.message?.includes('WRONGTYPE')) {
              console.warn('[SessionTracker] Type conflict detected, auto-fixing...');
              await this.initialize();
              return;
            }
          }
        }
      }

      console.debug(`[SessionTracker] Refreshed session: ${sessionId}`);
    } catch (error) {
      console.error('[SessionTracker] Failed to refresh session:', error);
    }
  }

  /**
   * 获取全局活跃 session 计数
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

        if (type !== 'zset') {
          console.warn(`[SessionTracker] ${key} is not ZSET (type=${type}), deleting...`);
          await redis.del(key);
          return 0;
        }

        return await this.countFromZSet(key);
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

        if (type !== 'zset') {
          console.warn(`[SessionTracker] ${key} is not ZSET (type=${type}), deleting...`);
          await redis.del(key);
          return 0;
        }

        return await this.countFromZSet(key);
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

        if (type !== 'zset') {
          console.warn(`[SessionTracker] ${key} is not ZSET (type=${type}), deleting...`);
          await redis.del(key);
          return 0;
        }

        return await this.countFromZSet(key);
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

        if (type !== 'zset') {
          console.warn(`[SessionTracker] ${key} is not ZSET (type=${type}), deleting...`);
          await redis.del(key);
          return [];
        }

        const now = Date.now();
        const fiveMinutesAgo = now - this.SESSION_TTL;

        // 清理过期 session
        await redis.zremrangebyscore(key, '-inf', fiveMinutesAgo);

        // 获取剩余的 session ID
        return await redis.zrange(key, 0, -1);
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

}
