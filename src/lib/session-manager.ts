import crypto from 'crypto';
import { getRedisClient } from './redis';

/**
 * Session 管理器
 *
 * 核心功能：
 * 1. 基于 messages 内容哈希识别 session
 * 2. 管理 session 与 provider 的绑定关系
 * 3. 支持客户端主动传递 session_id
 */
export class SessionManager {
  private static readonly SESSION_TTL = parseInt(process.env.SESSION_TTL || '300'); // 5 分钟

  /**
   * 从客户端请求中提取 session_id（支持 metadata 或 header）
   */
  static extractClientSessionId(requestMessage: Record<string, unknown>): string | null {
    // 尝试从 metadata.session_id 提取
    const metadata = requestMessage.metadata;
    if (metadata && typeof metadata === 'object') {
      const sessionId = (metadata as Record<string, unknown>).session_id;
      if (typeof sessionId === 'string' && sessionId.length > 0) {
        return sessionId;
      }
    }

    // 未来可扩展：从 header 提取（需要在 ProxySession 中传递 headers）
    return null;
  }

  /**
   * 生成新的 session_id
   * 格式：sess_{timestamp}_{random}
   */
  static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(6).toString('hex');
    return `sess_${timestamp}_${random}`;
  }

  /**
   * 计算 messages 内容哈希（用于 session 匹配）
   *
   * @param messages - 消息数组
   * @returns 哈希值（16 字符）或 null
   */
  static calculateMessagesHash(messages: unknown): string | null {
    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    // 计算范围：前 N 条（N = min(length, 3)）
    const count = Math.min(messages.length, 3);
    const contents: string[] = [];

    for (let i = 0; i < count; i++) {
      const message = messages[i];
      if (message && typeof message === 'object') {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === 'string') {
          contents.push(content);
        } else if (Array.isArray(content)) {
          // 支持多模态 content（数组格式）
          const textParts = content
            .filter((item) => item && typeof item === 'object' && (item as Record<string, unknown>).type === 'text')
            .map((item) => (item as Record<string, unknown>).text);
          contents.push(textParts.join(''));
        }
      }
    }

    if (contents.length === 0) {
      return null;
    }

    // 拼接并计算 SHA-256 哈希
    const combined = contents.join('|');
    const hash = crypto.createHash('sha256').update(combined, 'utf8').digest('hex');

    // 截取前 16 字符（足够区分，节省存储）
    return hash.substring(0, 16);
  }

  /**
   * 获取或创建 session_id（核心方法）
   *
   * @param keyId - API Key ID
   * @param messages - 消息数组
   * @param clientSessionId - 客户端传递的 session_id（可选）
   * @returns session_id
   */
  static async getOrCreateSessionId(
    keyId: number,
    messages: unknown,
    clientSessionId?: string | null
  ): Promise<string> {
    const redis = getRedisClient();

    // 1. 优先使用客户端传递的 session_id
    if (clientSessionId) {
      // 刷新 TTL（滑动窗口）
      if (redis && redis.status === 'ready') {
        await this.refreshSessionTTL(clientSessionId, keyId).catch((err) => {
          console.error('[SessionManager] Failed to refresh TTL:', err);
        });
      }
      return clientSessionId;
    }

    // 2. 计算 messages 哈希
    const contentHash = this.calculateMessagesHash(messages);
    if (!contentHash) {
      // 降级：无法计算哈希，生成新 session
      console.warn('[SessionManager] Cannot calculate hash, generating new session');
      return this.generateSessionId();
    }

    // 3. 尝试从 Redis 查找已有 session
    if (redis && redis.status === 'ready') {
      try {
        const hashKey = `hash:${contentHash}:session`;
        const existingSessionId = await redis.get(hashKey);

        if (existingSessionId) {
          // 找到已有 session，刷新 TTL
          await this.refreshSessionTTL(existingSessionId, keyId);
          console.debug(`[SessionManager] Reusing session ${existingSessionId} via hash ${contentHash}`);
          return existingSessionId;
        }

        // 未找到：创建新 session
        const newSessionId = this.generateSessionId();

        // 存储映射关系（异步，不阻塞）
        void this.storeSessionMapping(contentHash, newSessionId, keyId);

        console.debug(`[SessionManager] Created new session ${newSessionId} with hash ${contentHash}`);
        return newSessionId;
      } catch (error) {
        console.error('[SessionManager] Redis error:', error);
        // 降级：Redis 错误，生成新 session
        return this.generateSessionId();
      }
    }

    // 4. Redis 不可用，降级生成新 session
    return this.generateSessionId();
  }

  /**
   * 存储 hash → session 映射关系
   */
  private static async storeSessionMapping(
    contentHash: string,
    sessionId: string,
    keyId: number
  ): Promise<void> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;

    try {
      const pipeline = redis.pipeline();
      const hashKey = `hash:${contentHash}:session`;

      // 存储映射关系
      pipeline.setex(hashKey, this.SESSION_TTL, sessionId);

      // 初始化 session 元数据
      pipeline.setex(`session:${sessionId}:key`, this.SESSION_TTL, keyId.toString());
      pipeline.setex(`session:${sessionId}:last_seen`, this.SESSION_TTL, Date.now().toString());

      await pipeline.exec();
    } catch (error) {
      console.error('[SessionManager] Failed to store session mapping:', error);
    }
  }

  /**
   * 刷新 session TTL（滑动窗口）
   */
  private static async refreshSessionTTL(sessionId: string, keyId: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;

    try {
      const pipeline = redis.pipeline();

      // 刷新所有 session 相关 key 的 TTL
      pipeline.expire(`session:${sessionId}:key`, this.SESSION_TTL);
      pipeline.expire(`session:${sessionId}:provider`, this.SESSION_TTL);
      pipeline.setex(`session:${sessionId}:last_seen`, this.SESSION_TTL, Date.now().toString());

      // 刷新 active_sessions 集合的 TTL
      pipeline.expire(`key:${keyId}:active_sessions`, this.SESSION_TTL);

      await pipeline.exec();
    } catch (error) {
      console.error('[SessionManager] Failed to refresh TTL:', error);
    }
  }

  /**
   * 绑定 session 到 provider
   */
  static async bindSessionToProvider(sessionId: string, providerId: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return;

    try {
      await redis.setex(`session:${sessionId}:provider`, this.SESSION_TTL, providerId.toString());
      console.debug(`[SessionManager] Bound session ${sessionId} to provider ${providerId}`);
    } catch (error) {
      console.error('[SessionManager] Failed to bind provider:', error);
    }
  }

  /**
   * 获取 session 绑定的 provider
   */
  static async getSessionProvider(sessionId: string): Promise<number | null> {
    const redis = getRedisClient();
    if (!redis || redis.status !== 'ready') return null;

    try {
      const value = await redis.get(`session:${sessionId}:provider`);
      if (value) {
        const providerId = parseInt(value, 10);
        if (!isNaN(providerId)) {
          return providerId;
        }
      }
    } catch (error) {
      console.error('[SessionManager] Failed to get session provider:', error);
    }

    return null;
  }
}
