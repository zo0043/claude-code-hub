import { updateMessageRequestDuration, updateMessageRequestCost, updateMessageRequestDetails } from "@/repository/message";
import { findLatestPriceByModel } from "@/repository/model-price";
import { parseSSEData } from "@/lib/utils/sse";
import { calculateRequestCost } from "@/lib/utils/cost-calculation";
import { RateLimitService } from "@/lib/rate-limit";
import type { ProxySession } from "./session";
import { ProxyLogger } from "./logger";
import { ProxyStatusTracker } from "@/lib/proxy-status-tracker";
import { ResponseTransformer } from "../codex/transformers/response";
import type { ResponseResponse } from "../codex/types/response";

export type UsageMetrics = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export class ProxyResponseHandler {
  static async dispatch(session: ProxySession, response: Response): Promise<Response> {
    const contentType = response.headers.get("content-type") || "";
    const isSSE = contentType.includes("text/event-stream");

    if (!isSSE) {
      return ProxyResponseHandler.handleNonStream(session, response);
    }

    return await ProxyResponseHandler.handleStream(session, response);
  }

  private static async handleNonStream(session: ProxySession, response: Response): Promise<Response> {
    const provider = session.provider;
    if (!provider) {
      return response;
    }

    const responseForLog = response.clone();
    const statusCode = response.status;

    // ✅ 检查是否需要格式转换（OpenAI 请求 + Codex 供应商）
    const needsTransform = session.originalFormat === 'openai' && session.providerType === 'codex';
    let finalResponse = response;

    if (needsTransform) {
      try {
        // 克隆一份用于转换
        const responseForTransform = response.clone();
        const responseText = await responseForTransform.text();
        const responseData = JSON.parse(responseText) as ResponseResponse;

        // 转换为 OpenAI 格式
        const openAIResponse = ResponseTransformer.toOpenAI(responseData);

        console.debug('[ResponseHandler] Transformed Response API → OpenAI format (non-stream)');

        // 构建新的响应
        finalResponse = new Response(JSON.stringify(openAIResponse), {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers)
        });
      } catch (error) {
        console.error('[ResponseHandler] Failed to transform response:', error);
        // 转换失败时返回原始响应
        finalResponse = response;
      }
    }

    void (async () => {
      try {
        const responseText = await responseForLog.text();
        let responseLogContent = responseText;
        let usageRecord: Record<string, unknown> | null = null;
        let usageMetrics: UsageMetrics | null = null;

        try {
          const parsed = JSON.parse(responseText) as Record<string, unknown>;
          responseLogContent = JSON.stringify(parsed, null, 2);
          const usageValue = parsed.usage;
          if (usageValue && typeof usageValue === "object") {
            usageRecord = usageValue as Record<string, unknown>;
            usageMetrics = extractUsageMetrics(usageValue);
          }
        } catch {
          // 非 JSON 响应时保持原始日志
        }

        const messageContext = session.messageContext;
        if (usageRecord && usageMetrics && messageContext) {
          await updateRequestCostFromUsage(
            messageContext.id,
            session.request.model,
            usageMetrics,
            provider.costMultiplier
          );

          // 追踪消费到 Redis（用于限流）
          await trackCostToRedis(session, usageMetrics);
        }

        if (messageContext) {
          const duration = Date.now() - session.startTime;
          await updateMessageRequestDuration(messageContext.id, duration);

          // 保存扩展信息（status code, tokens, provider chain）
          await updateMessageRequestDetails(messageContext.id, {
            statusCode: statusCode,
            inputTokens: usageMetrics?.input_tokens,
            outputTokens: usageMetrics?.output_tokens,
            cacheCreationInputTokens: usageMetrics?.cache_creation_input_tokens,
            cacheReadInputTokens: usageMetrics?.cache_read_input_tokens,
            providerChain: session.getProviderChain()
          });

          // 记录请求结束
          const tracker = ProxyStatusTracker.getInstance();
          tracker.endRequest(messageContext.user.id, messageContext.id);
        }

        await ProxyLogger.logNonStream(session, provider, responseLogContent);
      } catch (error) {
        console.error("Failed to handle non-stream log:", error);
      }
    })();

    return finalResponse;
  }

  private static async handleStream(session: ProxySession, response: Response): Promise<Response> {
    const messageContext = session.messageContext;
    const provider = session.provider;

    if (!messageContext || !provider || !response.body) {
      return response;
    }

    const [clientStream, internalStream] = response.body.tee();
    const statusCode = response.status;

    void (async () => {
      const reader = internalStream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      let usageForCost: UsageMetrics | null = null;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            chunks.push(decoder.decode(value, { stream: true }));
          }
        }

        const flushed = decoder.decode();
        if (flushed) {
          chunks.push(flushed);
        }

        const allContent = chunks.join("");
        const parsedEvents = parseSSEData(allContent);

        const duration = Date.now() - session.startTime;
        await updateMessageRequestDuration(messageContext.id, duration);

        // 记录请求结束
        const tracker = ProxyStatusTracker.getInstance();
        tracker.endRequest(messageContext.user.id, messageContext.id);

        for (const event of parsedEvents) {
          if (event.event === "message_delta" && typeof event.data === "object" && event.data !== null) {
            const usageMetrics = extractUsageMetrics((event.data as Record<string, unknown>).usage);
            if (usageMetrics) {
              usageForCost = usageMetrics;
            }
          }
        }

        await updateRequestCostFromUsage(
          messageContext.id,
          session.request.model,
          usageForCost,
          provider.costMultiplier
        );

        // 追踪消费到 Redis（用于限流）
        await trackCostToRedis(session, usageForCost);

        // 保存扩展信息（status code, tokens, provider chain）
        await updateMessageRequestDetails(messageContext.id, {
          statusCode: statusCode,
          inputTokens: usageForCost?.input_tokens,
          outputTokens: usageForCost?.output_tokens,
          cacheCreationInputTokens: usageForCost?.cache_creation_input_tokens,
          cacheReadInputTokens: usageForCost?.cache_read_input_tokens,
          providerChain: session.getProviderChain()
        });
      } catch (error) {
        console.error("Failed to save SSE content:", error);
      } finally {
        reader.releaseLock();
      }
    })();

    return new Response(clientStream, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
  }
}

function extractUsageMetrics(value: unknown): UsageMetrics | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const usage = value as Record<string, unknown>;
  const result: UsageMetrics = {};
  let hasAny = false;

  if (typeof usage.input_tokens === "number") {
    result.input_tokens = usage.input_tokens;
    hasAny = true;
  }

  if (typeof usage.output_tokens === "number") {
    result.output_tokens = usage.output_tokens;
    hasAny = true;
  }

  if (typeof usage.cache_creation_input_tokens === "number") {
    result.cache_creation_input_tokens = usage.cache_creation_input_tokens;
    hasAny = true;
  }

  if (typeof usage.cache_read_input_tokens === "number") {
    result.cache_read_input_tokens = usage.cache_read_input_tokens;
    hasAny = true;
  }

  return hasAny ? result : null;
}

async function updateRequestCostFromUsage(
  messageId: number,
  modelName: string | null,
  usage: UsageMetrics | null,
  costMultiplier: number = 1.0
): Promise<void> {
  if (!modelName || !usage) {
    return;
  }

  const priceData = await findLatestPriceByModel(modelName);
  if (priceData?.priceData) {
    const cost = calculateRequestCost(usage, priceData.priceData, costMultiplier);
    if (cost.gt(0)) {
      await updateMessageRequestCost(messageId, cost);
    }
  }
}

/**
 * 追踪消费到 Redis（用于限流）
 */
async function trackCostToRedis(
  session: ProxySession,
  usage: UsageMetrics | null
): Promise<void> {
  if (!usage) return;

  const messageContext = session.messageContext;
  const provider = session.provider;
  const key = session.authState?.key;

  if (!messageContext || !provider || !key) return;

  const modelName = session.request.model;
  if (!modelName) return;

  // 计算成本（应用倍率）
  const priceData = await findLatestPriceByModel(modelName);
  if (!priceData?.priceData) return;

  const cost = calculateRequestCost(usage, priceData.priceData, provider.costMultiplier);
  if (cost.lte(0)) return;

  // 获取 sessionId（优先使用 conversation_id）
  const conversationId = typeof session.request.message === 'object' && session.request.message !== null
    ? (session.request.message as Record<string, unknown>).conversation_id
    : null;
  const sessionId = typeof conversationId === 'string' ? conversationId : `msg_${messageContext.id}`;

  // 追踪到 Redis
  await RateLimitService.trackCost(
    key.id,
    provider.id,
    sessionId,
    parseFloat(cost.toString())
  );
}
