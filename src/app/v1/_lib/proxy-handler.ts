import type { Context } from "hono";
import { logger } from "@/lib/logger";
import { ProxySession } from "./proxy/session";
import { ProxyAuthenticator } from "./proxy/auth-guard";
import { ProxySessionGuard } from "./proxy/session-guard";
import { ProxySensitiveWordGuard } from "./proxy/sensitive-word-guard";
import { ProxyRateLimitGuard } from "./proxy/rate-limit-guard";
import { ProxyProviderResolver } from "./proxy/provider-selector";
import { ProxyMessageService } from "./proxy/message-service";
import { ProxyForwarder } from "./proxy/forwarder";
import { ProxyResponseHandler } from "./proxy/response-handler";
import { ProxyErrorHandler } from "./proxy/error-handler";
import { ProxyStatusTracker } from "@/lib/proxy-status-tracker";
import { SessionTracker } from "@/lib/session-tracker";

export async function handleProxyRequest(c: Context): Promise<Response> {
  const session = await ProxySession.fromContext(c);

  try {
    // 1. 认证检查
    const unauthorized = await ProxyAuthenticator.ensure(session);
    if (unauthorized) {
      return unauthorized;
    }

    // 2. Session 分配（新增）
    await ProxySessionGuard.ensure(session);

    // 3. 敏感词检查（在计费之前）
    const blockedBySensitiveWord = await ProxySensitiveWordGuard.ensure(session);
    if (blockedBySensitiveWord) {
      return blockedBySensitiveWord;
    }

    // 4. 限流检查
    const rateLimited = await ProxyRateLimitGuard.ensure(session);
    if (rateLimited) {
      return rateLimited;
    }

    // 5. 供应商选择
    const providerUnavailable = await ProxyProviderResolver.ensure(session);
    if (providerUnavailable) {
      return providerUnavailable;
    }

    await ProxyMessageService.ensureContext(session);

    // 6. 增加并发计数（在所有检查通过后，请求开始前）
    if (session.sessionId) {
      await SessionTracker.incrementConcurrentCount(session.sessionId);
    }

    // 记录请求开始
    if (session.messageContext && session.provider) {
      const tracker = ProxyStatusTracker.getInstance();
      tracker.startRequest({
        userId: session.messageContext.user.id,
        userName: session.messageContext.user.name,
        requestId: session.messageContext.id,
        keyName: session.messageContext.key.name,
        providerId: session.provider.id,
        providerName: session.provider.name,
        model: session.request.model || "unknown",
      });
    }

    const response = await ProxyForwarder.send(session);
    return await ProxyResponseHandler.dispatch(session, response);
  } catch (error) {
    logger.error("Proxy handler error:", error);
    return await ProxyErrorHandler.handle(session, error);
  } finally {
    // 7. 减少并发计数（确保无论成功失败都执行）
    if (session.sessionId) {
      await SessionTracker.decrementConcurrentCount(session.sessionId);
    }
  }
}
