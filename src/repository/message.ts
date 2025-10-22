"use server";

import { db } from "@/drizzle/db";
import { logger } from "@/lib/logger";
import { messageRequest } from "@/drizzle/schema";
import { eq, isNull, and, desc, sql } from "drizzle-orm";
import type { MessageRequest, CreateMessageRequestData } from "@/types/message";
import { toMessageRequest } from "./_shared/transformers";
import { formatCostForStorage } from "@/lib/utils/currency";

/**
 * 创建消息请求记录
 */
export async function createMessageRequest(
  data: CreateMessageRequestData
): Promise<MessageRequest> {
  const formattedCost = formatCostForStorage(data.cost_usd);
  const dbData = {
    providerId: data.provider_id,
    userId: data.user_id,
    key: data.key,
    model: data.model,
    durationMs: data.duration_ms,
    costUsd: formattedCost ?? undefined,
    sessionId: data.session_id, // 新增：Session ID
  };

  const [result] = await db.insert(messageRequest).values(dbData).returning({
    id: messageRequest.id,
    providerId: messageRequest.providerId,
    userId: messageRequest.userId,
    key: messageRequest.key,
    model: messageRequest.model,
    durationMs: messageRequest.durationMs,
    costUsd: messageRequest.costUsd,
    sessionId: messageRequest.sessionId, // 新增
    createdAt: messageRequest.createdAt,
    updatedAt: messageRequest.updatedAt,
    deletedAt: messageRequest.deletedAt,
  });

  return toMessageRequest(result);
}

/**
 * 更新消息请求的耗时
 */
export async function updateMessageRequestDuration(id: number, durationMs: number): Promise<void> {
  await db
    .update(messageRequest)
    .set({
      durationMs: durationMs,
      updatedAt: new Date(),
    })
    .where(eq(messageRequest.id, id));
}

/**
 * 更新消息请求的费用
 */
export async function updateMessageRequestCost(
  id: number,
  costUsd: CreateMessageRequestData["cost_usd"]
): Promise<void> {
  const formattedCost = formatCostForStorage(costUsd);
  if (!formattedCost) {
    return;
  }

  await db
    .update(messageRequest)
    .set({
      costUsd: formattedCost,
      updatedAt: new Date(),
    })
    .where(eq(messageRequest.id, id));
}

/**
 * 更新消息请求的扩展信息（status code, tokens, provider chain, error）
 */
export async function updateMessageRequestDetails(
  id: number,
  details: {
    statusCode?: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    providerChain?: CreateMessageRequestData["provider_chain"];
    errorMessage?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (details.statusCode !== undefined) {
    updateData.statusCode = details.statusCode;
  }
  if (details.inputTokens !== undefined) {
    updateData.inputTokens = details.inputTokens;
  }
  if (details.outputTokens !== undefined) {
    updateData.outputTokens = details.outputTokens;
  }
  if (details.cacheCreationInputTokens !== undefined) {
    updateData.cacheCreationInputTokens = details.cacheCreationInputTokens;
  }
  if (details.cacheReadInputTokens !== undefined) {
    updateData.cacheReadInputTokens = details.cacheReadInputTokens;
  }
  if (details.providerChain !== undefined) {
    updateData.providerChain = details.providerChain;
  }
  if (details.errorMessage !== undefined) {
    updateData.errorMessage = details.errorMessage;
  }

  await db.update(messageRequest).set(updateData).where(eq(messageRequest.id, id));
}

/**
 * 根据用户ID查询消息请求记录（分页）
 */
export async function findLatestMessageRequestByKey(key: string): Promise<MessageRequest | null> {
  const [result] = await db
    .select({
      id: messageRequest.id,
      providerId: messageRequest.providerId,
      userId: messageRequest.userId,
      key: messageRequest.key,
      durationMs: messageRequest.durationMs,
      costUsd: messageRequest.costUsd,
      createdAt: messageRequest.createdAt,
      updatedAt: messageRequest.updatedAt,
      deletedAt: messageRequest.deletedAt,
    })
    .from(messageRequest)
    .where(and(eq(messageRequest.key, key), isNull(messageRequest.deletedAt)))
    .orderBy(desc(messageRequest.createdAt))
    .limit(1);

  if (!result) return null;
  return toMessageRequest(result);
}

/**
 * 查询使用日志（支持分页、时间筛选、模型筛选）
 */
export async function findUsageLogs(params: {
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  model?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ logs: MessageRequest[]; total: number }> {
  const { userId, startDate, endDate, model, page = 1, pageSize = 50 } = params;

  const conditions = [isNull(messageRequest.deletedAt)];

  if (userId !== undefined) {
    conditions.push(eq(messageRequest.userId, userId));
  }

  if (startDate) {
    conditions.push(sql`${messageRequest.createdAt} >= ${startDate}`);
  }

  if (endDate) {
    conditions.push(sql`${messageRequest.createdAt} <= ${endDate}`);
  }

  if (model) {
    conditions.push(eq(messageRequest.model, model));
  }

  // 查询总数
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messageRequest)
    .where(and(...conditions));

  const total = countResult?.count ?? 0;

  // 查询分页数据
  const offset = (page - 1) * pageSize;
  const results = await db
    .select()
    .from(messageRequest)
    .where(and(...conditions))
    .orderBy(desc(messageRequest.createdAt))
    .limit(pageSize)
    .offset(offset);

  const logs = results.map(toMessageRequest);

  return { logs, total };
}
