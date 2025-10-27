import {
  updateMessageRequestDuration,
  updateMessageRequestCost,
  updateMessageRequestDetails,
} from "@/repository/message";
import { findLatestPriceByModel } from "@/repository/model-price";
import { logger } from "@/lib/logger";
import { parseSSEData } from "@/lib/utils/sse";
import { calculateRequestCost } from "@/lib/utils/cost-calculation";
import { RateLimitService } from "@/lib/rate-limit";
import { SessionManager } from "@/lib/session-manager";
import { SessionTracker } from "@/lib/session-tracker";
import type { ProxySession } from "./session";
import { ProxyStatusTracker } from "@/lib/proxy-status-tracker";
import { ResponseTransformer } from "../codex/transformers/response";
import { StreamTransformer } from "../codex/transformers/stream";
import type { ResponseObject } from "../codex/types/response";

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
      return await ProxyResponseHandler.handleNonStream(session, response);
    }

    return await ProxyResponseHandler.handleStream(session, response);
  }

  private static async handleNonStream(
    session: ProxySession,
    response: Response
  ): Promise<Response> {
    const provider = session.provider;
    if (!provider) {
      return response;
    }

    const responseForLog = response.clone();
    const statusCode = response.status;

    // 检查是否需要格式转换（OpenAI 请求 + Codex 供应商）
    const needsTransform = session.originalFormat === "openai" && session.providerType === "codex";
    let finalResponse = response;

    if (needsTransform) {
      try {
        // 克隆一份用于转换
        const responseForTransform = response.clone();
        const responseText = await responseForTransform.text();
        const responseData = JSON.parse(responseText) as ResponseObject;

        // 转换为 OpenAI 格式
        const openAIResponse = ResponseTransformer.transform(responseData);

        logger.debug("[ResponseHandler] Transformed Response API → OpenAI format (non-stream)");

        // 构建新的响应
        finalResponse = new Response(JSON.stringify(openAIResponse), {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        });
      } catch (error) {
        logger.error("[ResponseHandler] Failed to transform response:", error);
        // 转换失败时返回原始响应
        finalResponse = response;
      }
    }

    void (async () => {
      try {
        const responseText = await responseForLog.text();
        // let responseLogContent = responseText; // 暂时未使用，注释掉
        let usageRecord: Record<string, unknown> | null = null;
        let usageMetrics: UsageMetrics | null = null;

        try {
          const parsed = JSON.parse(responseText) as Record<string, unknown>;
          // responseLogContent = JSON.stringify(parsed, null, 2); // 用于日志记录，暂时禁用
          const usageValue = parsed.usage;
          if (usageValue && typeof usageValue === "object") {
            usageRecord = usageValue as Record<string, unknown>;
            usageMetrics = extractUsageMetrics(usageValue);
          }
        } catch {
          // 非 JSON 响应时保持原始日志
        }

        // 存储响应体到 Redis（5分钟过期）
        if (session.sessionId) {
          void SessionManager.storeSessionResponse(session.sessionId, responseText).catch((err) => {
            logger.error("[ResponseHandler] Failed to store response:", err);
          });
        }

        const messageContext = session.messageContext;
        if (usageRecord && usageMetrics && messageContext) {
          await updateRequestCostFromUsage(
            messageContext.id,
            session.getOriginalModel(),
            session.getCurrentModel(),
            usageMetrics,
            provider.costMultiplier
          );

          // 追踪消费到 Redis（用于限流）
          await trackCostToRedis(session, usageMetrics);
        }

        // 更新 session 使用量到 Redis（用于实时监控）
        if (session.sessionId && usageMetrics) {
          // 计算成本（复用相同逻辑）
          let costUsdStr: string | undefined;
          if (session.request.model) {
            const priceData = await findLatestPriceByModel(session.request.model);
            if (priceData?.priceData) {
              const cost = calculateRequestCost(
                usageMetrics,
                priceData.priceData,
                provider.costMultiplier
              );
              if (cost.gt(0)) {
                costUsdStr = cost.toString();
              }
            }
          }

          void SessionManager.updateSessionUsage(session.sessionId, {
            inputTokens: usageMetrics.input_tokens,
            outputTokens: usageMetrics.output_tokens,
            cacheCreationInputTokens: usageMetrics.cache_creation_input_tokens,
            cacheReadInputTokens: usageMetrics.cache_read_input_tokens,
            costUsd: costUsdStr,
            status: statusCode >= 200 && statusCode < 300 ? "completed" : "error",
            statusCode: statusCode,
          }).catch((error: unknown) => {
            logger.error("[ResponseHandler] Failed to update session usage:", error);
          });
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
            providerChain: session.getProviderChain(),
          });

          // 记录请求结束
          const tracker = ProxyStatusTracker.getInstance();
          tracker.endRequest(messageContext.user.id, messageContext.id);
        }

        logger.debug("ResponseHandler: Non-stream response processed", {
          providerId: provider.id,
          providerName: provider.name,
          statusCode,
        });
      } catch (error) {
        logger.error("Failed to handle non-stream log:", error);
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

    // 检查是否需要格式转换（OpenAI 请求 + Codex 供应商）
    const needsTransform = session.originalFormat === "openai" && session.providerType === "codex";
    let processedStream: ReadableStream<Uint8Array> = response.body;

    if (needsTransform) {
      logger.debug("[ResponseHandler] Transforming Response API → OpenAI format (stream)");

      // 创建转换流
      const streamTransformer = new StreamTransformer();
      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          try {
            const decoder = new TextDecoder();
            const text = decoder.decode(chunk, { stream: true });

            // 解析并转换 SSE 事件
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") {
                  // 结束事件
                  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                } else {
                  try {
                    const event = JSON.parse(dataStr);
                    const transformedChunks = streamTransformer.transform(event);

                    // transformedChunks 可能是 null, single chunk, 或 array of chunks
                    if (transformedChunks === null) {
                      // 跳过此事件
                    } else if (Array.isArray(transformedChunks)) {
                      // 多个 chunks
                      for (const transformedChunk of transformedChunks) {
                        const chunkStr = `data: ${JSON.stringify(transformedChunk)}\n\n`;
                        controller.enqueue(new TextEncoder().encode(chunkStr));
                      }
                    } else {
                      // 单个 chunk
                      const chunkStr = `data: ${JSON.stringify(transformedChunks)}\n\n`;
                      controller.enqueue(new TextEncoder().encode(chunkStr));
                    }
                  } catch {
                    // 忽略解析错误的行
                  }
                }
              } else if (line.trim() === "") {
                // 保留空行（SSE 分隔符）
                controller.enqueue(new TextEncoder().encode("\n"));
              }
            }
          } catch (error) {
            logger.error("[ResponseHandler] Stream transform error:", error);
            // 出错时传递原始 chunk
            controller.enqueue(chunk);
          }
        },
      });

      processedStream = response.body.pipeThrough(transformStream) as ReadableStream<Uint8Array>;
    }

    const [clientStream, internalStream] = processedStream.tee();
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

        // 存储响应体到 Redis（5分钟过期）
        if (session.sessionId) {
          void SessionManager.storeSessionResponse(session.sessionId, allContent).catch((err) => {
            logger.error("[ResponseHandler] Failed to store stream response:", err);
          });
        }

        const parsedEvents = parseSSEData(allContent);

        const duration = Date.now() - session.startTime;
        await updateMessageRequestDuration(messageContext.id, duration);

        // 记录请求结束
        const tracker = ProxyStatusTracker.getInstance();
        tracker.endRequest(messageContext.user.id, messageContext.id);

        for (const event of parsedEvents) {
          if (
            event.event === "message_delta" &&
            typeof event.data === "object" &&
            event.data !== null
          ) {
            const usageMetrics = extractUsageMetrics((event.data as Record<string, unknown>).usage);
            if (usageMetrics) {
              usageForCost = usageMetrics;
            }
          }
        }

        await updateRequestCostFromUsage(
          messageContext.id,
          session.getOriginalModel(),
          session.getCurrentModel(),
          usageForCost,
          provider.costMultiplier
        );

        // 追踪消费到 Redis（用于限流）
        await trackCostToRedis(session, usageForCost);

        // 更新 session 使用量到 Redis（用于实时监控）
        if (session.sessionId && usageForCost) {
          // 计算成本（复用相同逻辑）
          let costUsdStr: string | undefined;
          if (session.request.model) {
            const priceData = await findLatestPriceByModel(session.request.model);
            if (priceData?.priceData) {
              const cost = calculateRequestCost(
                usageForCost,
                priceData.priceData,
                provider.costMultiplier
              );
              if (cost.gt(0)) {
                costUsdStr = cost.toString();
              }
            }
          }

          void SessionManager.updateSessionUsage(session.sessionId, {
            inputTokens: usageForCost.input_tokens,
            outputTokens: usageForCost.output_tokens,
            cacheCreationInputTokens: usageForCost.cache_creation_input_tokens,
            cacheReadInputTokens: usageForCost.cache_read_input_tokens,
            costUsd: costUsdStr,
            status: statusCode >= 200 && statusCode < 300 ? "completed" : "error",
            statusCode: statusCode,
          }).catch((error: unknown) => {
            logger.error("[ResponseHandler] Failed to update session usage:", error);
          });
        }

        // 保存扩展信息（status code, tokens, provider chain）
        await updateMessageRequestDetails(messageContext.id, {
          statusCode: statusCode,
          inputTokens: usageForCost?.input_tokens,
          outputTokens: usageForCost?.output_tokens,
          cacheCreationInputTokens: usageForCost?.cache_creation_input_tokens,
          cacheReadInputTokens: usageForCost?.cache_read_input_tokens,
          providerChain: session.getProviderChain(),
        });
      } catch (error) {
        logger.error("Failed to save SSE content:", error);
      } finally {
        reader.releaseLock();
      }
    })();

    return new Response(clientStream, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
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
  originalModel: string | null,
  redirectedModel: string | null,
  usage: UsageMetrics | null,
  costMultiplier: number = 1.0
): Promise<void> {
  if (!usage) {
    logger.warn("[CostCalculation] No usage data, skipping cost update", { messageId });
    return;
  }

  if (!originalModel && !redirectedModel) {
    logger.warn("[CostCalculation] No model name available", { messageId });
    return;
  }

  // Fallback 逻辑：优先原始模型，找不到则用重定向模型
  let priceData = null;
  let usedModelForPricing = null;

  // Step 1: 尝试原始模型
  if (originalModel) {
    priceData = await findLatestPriceByModel(originalModel);
    if (priceData?.priceData) {
      usedModelForPricing = originalModel;
      logger.debug("[CostCalculation] Using original model for pricing", {
        messageId,
        model: originalModel,
      });
    }
  }

  // Step 2: Fallback 到重定向模型
  if (!priceData && redirectedModel && redirectedModel !== originalModel) {
    priceData = await findLatestPriceByModel(redirectedModel);
    if (priceData?.priceData) {
      usedModelForPricing = redirectedModel;
      logger.warn("[CostCalculation] Original model price not found, using redirected model", {
        messageId,
        originalModel,
        redirectedModel,
      });
    }
  }

  // Step 3: 完全失败
  if (!priceData?.priceData) {
    logger.error("[CostCalculation] No price data found for any model", {
      messageId,
      originalModel,
      redirectedModel,
      note: "Cost will be $0. Please check price table or model name.",
    });
    return;
  }

  // 计算费用
  const cost = calculateRequestCost(usage, priceData.priceData, costMultiplier);

  logger.info("[CostCalculation] Cost calculated successfully", {
    messageId,
    usedModelForPricing,
    costUsd: cost.toString(),
    costMultiplier,
    usage,
  });

  if (cost.gt(0)) {
    await updateMessageRequestCost(messageId, cost);
  } else {
    logger.warn("[CostCalculation] Calculated cost is zero or negative", {
      messageId,
      usedModelForPricing,
      costUsd: cost.toString(),
      priceData: {
        inputCost: priceData.priceData.input_cost_per_token,
        outputCost: priceData.priceData.output_cost_per_token,
      },
    });
  }
}

/**
 * 追踪消费到 Redis（用于限流）
 */
async function trackCostToRedis(session: ProxySession, usage: UsageMetrics | null): Promise<void> {
  if (!usage || !session.sessionId) return;

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

  // 追踪到 Redis（使用 session.sessionId）
  await RateLimitService.trackCost(
    key.id,
    provider.id,
    session.sessionId, // 直接使用 session.sessionId
    parseFloat(cost.toString())
  );

  // 刷新 session 时间戳（滑动窗口）
  void SessionTracker.refreshSession(session.sessionId, key.id, provider.id).catch((error) => {
    logger.error("[ResponseHandler] Failed to refresh session tracker:", error);
  });
}
