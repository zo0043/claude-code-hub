import type { Context } from "hono";
import { logger } from "@/lib/logger";
import { ProxySession } from "./proxy/session";
import { ProxyAuthenticator } from "./proxy/auth-guard";
import { ProxySessionGuard } from "./proxy/session-guard";
import { ProxyRateLimitGuard } from "./proxy/rate-limit-guard";
import { ProxyProviderResolver } from "./proxy/provider-selector";
import { ProxyMessageService } from "./proxy/message-service";
import { ProxyForwarder } from "./proxy/forwarder";
import { ProxyResponseHandler } from "./proxy/response-handler";
import { ProxyErrorHandler } from "./proxy/error-handler";
import { ProxyStatusTracker } from "@/lib/proxy-status-tracker";

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

    // 3. 限流检查
    const rateLimited = await ProxyRateLimitGuard.ensure(session);
    if (rateLimited) {
      return rateLimited;
    }

    // 4. 供应商选择
    const providerUnavailable = await ProxyProviderResolver.ensure(session);
    if (providerUnavailable) {
      return providerUnavailable;
    }

    await ProxyMessageService.ensureContext(session);

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
  }
}
