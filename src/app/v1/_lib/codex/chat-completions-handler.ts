import type { Context } from "hono";
import { ProxySession } from "../proxy/session";
import { ProxyAuthenticator } from "../proxy/auth-guard";
import { ProxyRateLimitGuard } from "../proxy/rate-limit-guard";
import { ProxyProviderResolver } from "../proxy/provider-selector";
import { ProxyMessageService } from "../proxy/message-service";
import { ProxyForwarder } from "../proxy/forwarder";
import { ProxyResponseHandler } from "../proxy/response-handler";
import { ProxyErrorHandler } from "../proxy/error-handler";
import { ProxyStatusTracker } from "@/lib/proxy-status-tracker";
import { RequestTransformer } from "./transformers/request";
import type { ChatCompletionRequest } from "./types/compatible";

/**
 * 处理 OpenAI Compatible API 请求 (/v1/chat/completions)
 *
 * 工作流程：
 * 1. 解析 OpenAI 格式请求
 * 2. 转换为 Response API 格式
 * 3. 复用现有代理流程
 * 4. 响应自动转换回 OpenAI 格式（在 ResponseHandler 中）
 */
export async function handleChatCompletions(c: Context): Promise<Response> {
  console.info('[ChatCompletions] Received OpenAI Compatible API request');

  const session = await ProxySession.fromContext(c);

  try {
    // ✅ 识别为 OpenAI 格式（用于响应转换）
    session.setOriginalFormat('openai');

    // ✅ 验证请求格式
    const openAIRequest = session.request.message as ChatCompletionRequest;
    if (!openAIRequest.model || !openAIRequest.messages) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Invalid request: model and messages are required',
            type: 'invalid_request_error',
            code: 'missing_required_fields'
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.debug('[ChatCompletions] Request details:', {
      model: openAIRequest.model,
      stream: openAIRequest.stream,
      messageCount: openAIRequest.messages.length
    });

    // ✅ 转换请求体：OpenAI → Response API
    try {
      const responseRequest = RequestTransformer.transform(openAIRequest);

      console.debug('[ChatCompletions] Transformed to Response API:', {
        model: responseRequest.model,
        inputCount: responseRequest.input?.length,
        hasReasoning: !!responseRequest.reasoning
      });

      // ✅ 更新 session（替换为 Response API 格式）
      session.request.message = responseRequest as unknown as Record<string, unknown>;
      session.request.model = responseRequest.model;

      // 重新生成请求 buffer
      const encoder = new TextEncoder();
      session.request.buffer = encoder.encode(JSON.stringify(responseRequest)).buffer;

    } catch (transformError) {
      console.error('[ChatCompletions] Request transformation failed:', transformError);
      return new Response(
        JSON.stringify({
          error: {
            message: 'Failed to transform request format',
            type: 'invalid_request_error',
            code: 'transformation_error'
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 复用现有代理流程
    // 1. 认证检查
    const unauthorized = await ProxyAuthenticator.ensure(session);
    if (unauthorized) {
      return unauthorized;
    }

    // 2. 限流检查
    const rateLimited = await ProxyRateLimitGuard.ensure(session);
    if (rateLimited) {
      return rateLimited;
    }

    // 3. 供应商选择（指定 Codex 类型）
    const providerUnavailable = await ProxyProviderResolver.ensure(session, 'codex');
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

    // 4. 转发请求（ModelRedirector 会在 Forwarder 中自动应用）
    const response = await ProxyForwarder.send(session);

    // 5. 响应处理（自动转换回 OpenAI 格式）
    return await ProxyResponseHandler.dispatch(session, response);

  } catch (error) {
    console.error("[ChatCompletions] Handler error:", error);
    return await ProxyErrorHandler.handle(session, error);
  }
}
