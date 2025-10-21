import { updateMessageRequestDuration, updateMessageRequestDetails } from "@/repository/message";
import { ProxyLogger } from "./logger";
import { ProxyResponses } from "./responses";
import type { ProxySession } from "./session";
import { ProxyStatusTracker } from "@/lib/proxy-status-tracker";

export class ProxyErrorHandler {
  static async handle(session: ProxySession, error: unknown): Promise<Response> {
    const errorMessage = error instanceof Error ? error.message : "代理请求发生未知错误";

    if (session.messageContext) {
      const duration = Date.now() - session.startTime;
      await updateMessageRequestDuration(session.messageContext.id, duration);

      // 保存错误信息和决策链
      await updateMessageRequestDetails(session.messageContext.id, {
        errorMessage: errorMessage,
        providerChain: session.getProviderChain(),
        statusCode: 500 // 错误情况默认状态码 500
      });

      // 记录请求结束
      const tracker = ProxyStatusTracker.getInstance();
      tracker.endRequest(session.messageContext.user.id, session.messageContext.id);
    }

    await ProxyLogger.logFailure(session, error);

    return ProxyResponses.buildError(500, errorMessage);
  }
}
