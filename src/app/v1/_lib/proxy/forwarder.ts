import { HeaderProcessor } from "../headers";
import { buildProxyUrl } from "../url";
import { recordFailure, recordSuccess, getCircuitState } from "@/lib/circuit-breaker";
import { ProxyProviderResolver } from "./provider-selector";
import { ProxyError } from "./errors";
import { ModelRedirector } from "./model-redirector";
import type { ProxySession } from "./session";

const MAX_RETRY_ATTEMPTS = 3;

export class ProxyForwarder {
  static async send(session: ProxySession): Promise<Response> {
    if (!session.provider || !session.authState?.success) {
      throw new Error("代理上下文缺少供应商或鉴权信息");
    }

    let lastError: Error | null = null;
    let attemptCount = 0;
    let currentProvider = session.provider;
    const failedProviderIds: number[] = [];  // 记录已失败的供应商ID

    // 智能重试循环
    while (attemptCount <= MAX_RETRY_ATTEMPTS) {
      try {
        const response = await ProxyForwarder.doForward(session, currentProvider);

        // 成功：记录健康状态
        recordSuccess(currentProvider.id);

        console.debug(`[ProxyForwarder] Request successful with provider ${currentProvider.id} (attempt ${attemptCount + 1})`);

        return response;

      } catch (error) {
        attemptCount++;
        lastError = error as Error;
        failedProviderIds.push(currentProvider.id);  // 记录失败的供应商

        // 提取错误信息（支持 ProxyError 和普通 Error）
        const errorMessage = error instanceof ProxyError
          ? error.getDetailedErrorMessage()
          : (error as Error).message;

        // 记录失败的供应商和错误信息到决策链
        session.addProviderToChain(currentProvider, {
          reason: 'retry_attempt',
          circuitState: getCircuitState(currentProvider.id),
          attemptNumber: attemptCount,
          errorMessage: errorMessage,  // 记录完整上游错误
        });

        // 记录失败
        recordFailure(currentProvider.id, lastError);

        console.warn(
          `[ProxyForwarder] Provider ${currentProvider.id} failed (attempt ${attemptCount}/${MAX_RETRY_ATTEMPTS + 1}): ${lastError.message}`
        );

        // 如果还有重试机会，选择新的供应商
        if (attemptCount <= MAX_RETRY_ATTEMPTS) {
          const alternativeProvider = await ProxyForwarder.selectAlternative(
            session,
            failedProviderIds  // 传入所有已失败的供应商ID列表
          );

          if (!alternativeProvider) {
            console.error(`[ProxyForwarder] No alternative provider available, stopping retries`);
            break;
          }

          currentProvider = alternativeProvider;
          session.setProvider(currentProvider);

          console.info(`[ProxyForwarder] Retry ${attemptCount}: Switched to provider ${currentProvider.id}`);
        }
      }
    }

    // 所有重试都失败
    // 如果最后一个错误是 ProxyError，提取详细信息（包含上游响应）
    const errorDetails = lastError instanceof ProxyError
      ? lastError.getDetailedErrorMessage()
      : (lastError?.message || 'Unknown error');

    throw new Error(
      `All providers failed after ${attemptCount} attempts. Last error: ${errorDetails}`
    );
  }

  /**
   * 实际转发请求
   */
  private static async doForward(session: ProxySession, provider: typeof session.provider): Promise<Response> {
    if (!provider) {
      throw new Error("Provider is required");
    }

    // 应用模型重定向（如果配置了）
    const wasRedirected = ModelRedirector.apply(session, provider);
    if (wasRedirected) {
      console.debug(`[ProxyForwarder] Model redirected for provider ${provider.id}`);
    }

    const processedHeaders = ProxyForwarder.buildHeaders(session, provider);

    // 根据请求格式动态选择转发路径
    let forwardUrl = session.requestUrl;

    // OpenAI Compatible 请求：自动替换为 Response API 端点
    if (session.originalFormat === 'openai') {
      forwardUrl = new URL(session.requestUrl);
      forwardUrl.pathname = '/v1/responses';
      console.debug(`[ProxyForwarder] Codex request: rewriting path ${session.requestUrl.pathname} → /v1/responses`);
    }

    const proxyUrl = buildProxyUrl(provider.url, forwardUrl);

    // 输出最终代理 URL（用于调试）
    console.debug(`[ProxyForwarder] Final proxy URL: ${proxyUrl}`);

    const hasBody = session.method !== "GET" && session.method !== "HEAD";

    // 关键修复：使用转换后的 message 而非原始 buffer
    // 确保 OpenAI 格式转换为 Response API 后，发送的是包含 input 字段的请求体
    let requestBody: BodyInit | undefined;
    if (hasBody) {
      const bodyString = JSON.stringify(session.request.message);
      requestBody = bodyString;

      // 调试日志：输出实际转发的请求体（仅在开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[ProxyForwarder] Forwarding request:`, {
          provider: provider.name,
          providerId: provider.id,
          proxyUrl: proxyUrl,
          format: session.originalFormat,
          method: session.method,
          bodyLength: bodyString.length,
          bodyPreview: bodyString.slice(0, 1000)
        });
      }
    }

    const init: RequestInit = {
      method: session.method,
      headers: processedHeaders,
      ...(requestBody ? { body: requestBody } : {})
    };

    (init as Record<string, unknown>).verbose = true;

    let response: Response;
    try {
      response = await fetch(proxyUrl, init);
    } catch (fetchError) {
      // 捕获 fetch 原始错误（网络错误、DNS 解析失败、JSON 序列化错误等）
      console.error(`[ProxyForwarder] Fetch failed for provider ${provider.id}:`, {
        error: fetchError,
        errorType: fetchError?.constructor?.name,
        errorMessage: (fetchError as Error)?.message,
        errorCause: (fetchError as any)?.cause,
        proxyUrl: proxyUrl,
        method: session.method,
        hasBody: !!requestBody,
      });

      throw fetchError;
    }

    // 检查 HTTP 错误状态（4xx/5xx 均视为失败，触发重试）
    // 注意：用户要求所有 4xx 都重试，包括 401、403、429 等
    if (!response.ok) {
      throw await ProxyError.fromUpstreamResponse(response, {
        id: provider.id,
        name: provider.name
      });
    }

    return response;
  }

  /**
   * 选择替代供应商（排除所有已失败的供应商）
   */
  private static async selectAlternative(
    session: ProxySession,
    excludeProviderIds: number[]  // 改为数组，排除所有失败的供应商
  ): Promise<typeof session.provider | null> {
    // 使用公开的选择方法，传入排除列表
    const alternativeProvider = await ProxyProviderResolver.pickRandomProviderWithExclusion(
      session,
      excludeProviderIds
    );

    if (!alternativeProvider) {
      console.warn(
        `[ProxyForwarder] No alternative provider available (excluded: ${excludeProviderIds.join(', ')})`
      );
      return null;
    }

    // 确保不是已失败的供应商之一
    if (excludeProviderIds.includes(alternativeProvider.id)) {
      console.error(
        `[ProxyForwarder] Selector returned excluded provider ${alternativeProvider.id}, this should not happen`
      );
      return null;
    }

    return alternativeProvider;
  }

  private static buildHeaders(session: ProxySession, provider: NonNullable<typeof session.provider>): Headers {
    const outboundKey = provider.key;

    const headerProcessor = HeaderProcessor.createForProxy({
      blacklist: [],
      overrides: {
        "host": HeaderProcessor.extractHost(provider.url),
        "authorization": `Bearer ${outboundKey}`,
        "x-api-key": outboundKey
      }
    });

    return headerProcessor.process(session.headers);
  }
}
