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
    const failedProviderIds: number[] = [];  // ✅ 记录已失败的供应商ID

    // 智能重试循环
    while (attemptCount <= MAX_RETRY_ATTEMPTS) {
      try {
        // ✅ 重试时记录决策链（初始选择在 ProxyProviderResolver.ensure 中已记录）
        if (attemptCount > 0) {
          session.addProviderToChain(currentProvider, {
            reason: 'retry_attempt',
            circuitState: getCircuitState(currentProvider.id),
            attemptNumber: attemptCount + 1,
          });
        }

        const response = await ProxyForwarder.doForward(session, currentProvider);

        // 成功：记录健康状态
        recordSuccess(currentProvider.id);

        console.debug(`[ProxyForwarder] Request successful with provider ${currentProvider.id} (attempt ${attemptCount + 1})`);

        return response;

      } catch (error) {
        attemptCount++;
        lastError = error as Error;
        failedProviderIds.push(currentProvider.id);  // ✅ 记录失败的供应商

        // 记录失败
        recordFailure(currentProvider.id, lastError);

        console.warn(
          `[ProxyForwarder] Provider ${currentProvider.id} failed (attempt ${attemptCount}/${MAX_RETRY_ATTEMPTS + 1}): ${lastError.message}`
        );

        // 如果还有重试机会，选择新的供应商
        if (attemptCount <= MAX_RETRY_ATTEMPTS) {
          const alternativeProvider = await ProxyForwarder.selectAlternative(
            session,
            failedProviderIds  // ✅ 传入所有已失败的供应商ID列表
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

    // ✅ 应用模型重定向（如果配置了）
    const wasRedirected = ModelRedirector.apply(session, provider);
    if (wasRedirected) {
      console.debug(`[ProxyForwarder] Model redirected for provider ${provider.id}`);
    }

    const processedHeaders = ProxyForwarder.buildHeaders(session, provider);
    const proxyUrl = buildProxyUrl(provider.url, session.requestUrl);

    const hasBody = session.method !== "GET" && session.method !== "HEAD";
    const init: RequestInit = {
      method: session.method,
      headers: processedHeaders,
      ...(hasBody && session.request.buffer ? { body: session.request.buffer } : {})
    };

    (init as Record<string, unknown>).verbose = true;

    const response = await fetch(proxyUrl, init);

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
    excludeProviderIds: number[]  // ✅ 改为数组，排除所有失败的供应商
  ): Promise<typeof session.provider | null> {
    // ✅ 使用公开的选择方法，传入排除列表
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

    // ✅ 确保不是已失败的供应商之一
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
