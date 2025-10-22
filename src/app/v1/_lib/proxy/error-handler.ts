import { updateMessageRequestDuration, updateMessageRequestDetails } from "@/repository/message";
import { logger } from '@/lib/logger';
import { ProxyLogger } from "./logger";
import { ProxyResponses } from "./responses";
import { ProxyError } from "./errors";
import type { ProxySession } from "./session";
import { ProxyStatusTracker } from "@/lib/proxy-status-tracker";

export class ProxyErrorHandler {
  static async handle(session: ProxySession, error: unknown): Promise<Response> {
    let errorMessage: string;
    let statusCode = 500;

    // 识别 ProxyError，提取详细信息（包含上游响应）
    if (error instanceof ProxyError) {
      errorMessage = error.getDetailedErrorMessage();
      // 4xx 客户端错误返回原始状态码，5xx 统一返回 500
      statusCode = error.statusCode >= 500 ? 500 : error.statusCode;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = "代理请求发生未知错误";
    }

    if (session.messageContext) {
      const duration = Date.now() - session.startTime;
      await updateMessageRequestDuration(session.messageContext.id, duration);

      // 保存错误信息和决策链（现在包含完整上游错误）
      await updateMessageRequestDetails(session.messageContext.id, {
        errorMessage: errorMessage,
        providerChain: session.getProviderChain(),
        statusCode: statusCode,
      });

      // 记录请求结束
      const tracker = ProxyStatusTracker.getInstance();
      tracker.endRequest(session.messageContext.user.id, session.messageContext.id);
    }

    await ProxyLogger.logFailure(session, error);

    return ProxyResponses.buildError(statusCode, errorMessage);
  }
}
