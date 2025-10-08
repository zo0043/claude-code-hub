"use server";

import { db } from "@/drizzle/db";
import { messageRequest } from "@/drizzle/schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import type {
  MessageRequest,
  CreateMessageRequestData
} from "@/types/message";
import { toMessageRequest } from "./_shared/transformers";
import { formatCostForStorage } from "@/lib/utils/currency";

/**
 * 创建消息请求记录
 */
export async function createMessageRequest(data: CreateMessageRequestData): Promise<MessageRequest> {
  const formattedCost = formatCostForStorage(data.cost_usd);
  const dbData = {
    providerId: data.provider_id,
    userId: data.user_id,
    key: data.key,
    model: data.model,
    durationMs: data.duration_ms,
    costUsd: formattedCost ?? undefined,
  };

  const [result] = await db.insert(messageRequest).values(dbData).returning({
    id: messageRequest.id,
    providerId: messageRequest.providerId,
    userId: messageRequest.userId,
    key: messageRequest.key,
    model: messageRequest.model,
    durationMs: messageRequest.durationMs,
    costUsd: messageRequest.costUsd,
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
      updatedAt: new Date()
    })
    .where(eq(messageRequest.id, id));
}

/**
 * 更新消息请求的费用
 */
export async function updateMessageRequestCost(id: number, costUsd: CreateMessageRequestData["cost_usd"]): Promise<void> {
  const formattedCost = formatCostForStorage(costUsd);
  if (!formattedCost) {
    return;
  }

  await db
    .update(messageRequest)
    .set({
      costUsd: formattedCost,
      updatedAt: new Date()
    })
    .where(eq(messageRequest.id, id));
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
    .where(and(
      eq(messageRequest.key, key),
      isNull(messageRequest.deletedAt)
    ))
    .orderBy(desc(messageRequest.createdAt))
    .limit(1);

  if (!result) return null;
  return toMessageRequest(result);
}
