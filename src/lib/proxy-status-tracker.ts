import { db } from "@/drizzle/db";
import { messageRequest, providers, keys } from "@/drizzle/schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import type {
  ActiveRequest,
  LastRequest,
  UserProxyStatus,
  ProxyStatusResponse,
} from "@/types/proxy-status";

/**
 * 代理状态追踪器
 * 使用单例模式管理所有用户的代理请求状态
 *
 * 职责:
 * - 追踪当前活跃的代理请求
 * - 记录用户最后一次请求信息
 * - 提供查询接口给前端展示
 */
export class ProxyStatusTracker {
  private static instance: ProxyStatusTracker | null = null;

  /** 内存存储：userId -> UserProxyStatus */
  private statusMap: Map<number, UserProxyStatus>;

  private constructor() {
    this.statusMap = new Map();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ProxyStatusTracker {
    if (!ProxyStatusTracker.instance) {
      ProxyStatusTracker.instance = new ProxyStatusTracker();
    }
    return ProxyStatusTracker.instance;
  }

  /**
   * 开始一个代理请求
   * 在 ProxyMessageService.ensureContext 之后调用
   */
  startRequest(params: {
    userId: number;
    userName: string;
    requestId: number;
    keyName: string;
    providerId: number;
    providerName: string;
    model: string;
  }): void {
    const userStatus = this.ensureUserStatus(params.userId, params.userName);

    const activeRequest: ActiveRequest = {
      requestId: params.requestId,
      keyName: params.keyName,
      providerId: params.providerId,
      providerName: params.providerName,
      model: params.model,
      startTime: Date.now(),
    };

    userStatus.activeRequests.set(params.requestId, activeRequest);
  }

  /**
   * 结束一个代理请求
   * 在 ProxyResponseHandler 或 ProxyErrorHandler 中调用
   */
  endRequest(userId: number, requestId: number): void {
    const userStatus = this.statusMap.get(userId);
    if (!userStatus) {
      return;
    }

    const activeRequest = userStatus.activeRequests.get(requestId);
    if (!activeRequest) {
      return;
    }

    // 从活跃列表中移除
    userStatus.activeRequests.delete(requestId);

    // 更新最后一次请求
    userStatus.lastRequest = {
      requestId: activeRequest.requestId,
      keyName: activeRequest.keyName,
      providerId: activeRequest.providerId,
      providerName: activeRequest.providerName,
      model: activeRequest.model,
      endTime: Date.now(),
    };
  }

  /**
   * 获取所有用户的代理状态
   * 用于 API 端点返回给前端
   */
  async getAllUsersStatus(): Promise<ProxyStatusResponse> {
    const now = Date.now();
    const users: ProxyStatusResponse["users"] = [];

    for (const [userId, userStatus] of this.statusMap) {
      // 如果没有活跃请求且没有最后一次请求记录，且未从数据库加载过，则尝试加载
      if (
        userStatus.activeRequests.size === 0 &&
        !userStatus.lastRequest &&
        !userStatus.dbLoaded
      ) {
        const lastRequest = await this.loadLastRequestFromDB(userId);
        if (lastRequest) {
          userStatus.lastRequest = lastRequest;
        }
        userStatus.dbLoaded = true; // 标记已加载，避免重复查询
      }

      // 构建活跃请求列表
      const activeRequests = Array.from(
        userStatus.activeRequests.values()
      ).map((req) => ({
        requestId: req.requestId,
        keyName: req.keyName,
        providerId: req.providerId,
        providerName: req.providerName,
        model: req.model,
        startTime: req.startTime,
        duration: now - req.startTime,
      }));

      // 构建最后一次请求信息
      const lastRequest = userStatus.lastRequest
        ? {
            requestId: userStatus.lastRequest.requestId,
            keyName: userStatus.lastRequest.keyName,
            providerId: userStatus.lastRequest.providerId,
            providerName: userStatus.lastRequest.providerName,
            model: userStatus.lastRequest.model,
            endTime: userStatus.lastRequest.endTime,
            elapsed: now - userStatus.lastRequest.endTime,
          }
        : null;

      users.push({
        userId,
        userName: userStatus.userName,
        activeCount: userStatus.activeRequests.size,
        activeRequests,
        lastRequest,
      });
    }

    return { users };
  }

  /**
   * 确保用户状态存在（私有方法）
   */
  private ensureUserStatus(
    userId: number,
    userName: string
  ): UserProxyStatus {
    let userStatus = this.statusMap.get(userId);

    if (!userStatus) {
      userStatus = {
        userId,
        userName,
        activeRequests: new Map(),
        lastRequest: null,
        dbLoaded: false,
      };
      this.statusMap.set(userId, userStatus);
    }

    return userStatus;
  }

  /**
   * 从数据库加载用户最后一次请求（私有方法）
   * 只在内存中没有记录时调用（比如程序重启后）
   */
  private async loadLastRequestFromDB(
    userId: number
  ): Promise<LastRequest | null> {
    const [result] = await db
      .select({
        requestId: messageRequest.id,
        keyString: messageRequest.key,
        keyName: keys.name,
        providerId: messageRequest.providerId,
        providerName: providers.name,
        updatedAt: messageRequest.updatedAt,
      })
      .from(messageRequest)
      .innerJoin(providers, eq(messageRequest.providerId, providers.id))
      .innerJoin(
        keys,
        and(
          eq(keys.key, messageRequest.key),
          isNull(keys.deletedAt)
        )
      )
      .where(
        and(
          eq(messageRequest.userId, userId),
          isNull(messageRequest.deletedAt),
          isNull(providers.deletedAt)
        )
      )
      .orderBy(desc(messageRequest.updatedAt))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      requestId: result.requestId,
      keyName: result.keyName || result.keyString,
      providerId: result.providerId,
      providerName: result.providerName,
      model: "unknown",
      endTime: result.updatedAt?.getTime() || Date.now(),
    };
  }
}
