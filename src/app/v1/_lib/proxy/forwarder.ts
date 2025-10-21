import { HeaderProcessor } from "../headers";
import { buildProxyUrl } from "../url";
import { recordFailure, recordSuccess } from "@/lib/circuit-breaker";
import { ProxyProviderResolver } from "./provider-selector";
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

        // 记录失败
        recordFailure(currentProvider.id, lastError);

        console.warn(
          `[ProxyForwarder] Provider ${currentProvider.id} failed (attempt ${attemptCount}/${MAX_RETRY_ATTEMPTS + 1}): ${lastError.message}`
        );

        // 如果还有重试机会，选择新的供应商
        if (attemptCount <= MAX_RETRY_ATTEMPTS) {
          const alternativeProvider = await ProxyForwarder.selectAlternative(session, currentProvider.id);

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
    throw new Error(
      `All providers failed after ${attemptCount} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * 实际转发请求
   */
  private static async doForward(session: ProxySession, provider: typeof session.provider): Promise<Response> {
    if (!provider) {
      throw new Error("Provider is required");
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

    // 检查 HTTP 错误状态（5xx 视为失败，触发重试）
    if (response.status >= 500) {
      throw new Error(`Provider returned ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  /**
   * 选择替代供应商（排除已失败的）
   */
  private static async selectAlternative(
    session: ProxySession,
    excludeProviderId: number
  ): Promise<typeof session.provider | null> {
    // 临时清除当前供应商，强制重新选择
    session.setProvider(null);

    // 使用供应商选择器重新选择（会自动过滤掉熔断的供应商）
    const result = await ProxyProviderResolver.ensure(session);

    // 如果返回了错误响应，说明没有可用供应商
    if (result) {
      return null;
    }

    // 确保不是同一个供应商
    if (session.provider?.id === excludeProviderId) {
      console.warn(`[ProxyForwarder] Provider selector returned the same failed provider ${excludeProviderId}`);
      return null;
    }

    return session.provider;
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
