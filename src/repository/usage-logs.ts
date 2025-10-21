"use server";

import { db } from "@/drizzle/db";
import { messageRequest, users, keys as keysTable, providers } from "@/drizzle/schema";
import { and, eq, isNull, gte, lte, desc, sql, inArray } from "drizzle-orm";

export interface UsageLogFilters {
  userId?: number;
  keyId?: number;
  providerId?: number;
  startDate?: Date;
  endDate?: Date;
  statusCode?: number;
  model?: string;
  page?: number;
  pageSize?: number;
}

export interface UsageLogRow {
  id: number;
  createdAt: Date | null;
  userName: string;
  keyName: string;
  providerName: string;
  model: string | null;
  statusCode: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  totalTokens: number;
  costUsd: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  providerChain: Array<{ id: number; name: string }> | null;
}

export interface UsageLogSummary {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
}

export interface UsageLogsResult {
  logs: UsageLogRow[];
  total: number;
  summary: UsageLogSummary;
}

/**
 * 查询使用日志（支持多种筛选条件和分页）
 */
export async function findUsageLogsWithDetails(
  filters: UsageLogFilters
): Promise<UsageLogsResult> {
  const {
    userId,
    keyId,
    providerId,
    startDate,
    endDate,
    statusCode,
    model,
    page = 1,
    pageSize = 50
  } = filters;

  // 构建查询条件
  const conditions = [isNull(messageRequest.deletedAt)];

  if (userId !== undefined) {
    conditions.push(eq(messageRequest.userId, userId));
  }

  if (keyId !== undefined) {
    // 通过 key ID 查找对应的 key 值
    const keyResult = await db
      .select({ key: keysTable.key })
      .from(keysTable)
      .where(and(eq(keysTable.id, keyId), isNull(keysTable.deletedAt)))
      .limit(1);

    if (keyResult.length > 0) {
      conditions.push(eq(messageRequest.key, keyResult[0].key));
    } else {
      // key 不存在，返回空结果
      return {
        logs: [],
        total: 0,
        summary: { totalRequests: 0, totalCost: 0, totalTokens: 0 }
      };
    }
  }

  if (providerId !== undefined) {
    conditions.push(eq(messageRequest.providerId, providerId));
  }

  if (startDate) {
    conditions.push(gte(messageRequest.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(messageRequest.createdAt, endDate));
  }

  if (statusCode !== undefined) {
    conditions.push(eq(messageRequest.statusCode, statusCode));
  }

  if (model) {
    conditions.push(eq(messageRequest.model, model));
  }

  // 查询总数和统计数据
  const [summaryResult] = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      totalCost: sql<string>`COALESCE(sum(${messageRequest.costUsd}), 0)`,
      totalInputTokens: sql<number>`COALESCE(sum(${messageRequest.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`COALESCE(sum(${messageRequest.outputTokens}), 0)::int`,
      totalCacheCreationTokens: sql<number>`COALESCE(sum(${messageRequest.cacheCreationInputTokens}), 0)::int`,
      totalCacheReadTokens: sql<number>`COALESCE(sum(${messageRequest.cacheReadInputTokens}), 0)::int`,
    })
    .from(messageRequest)
    .where(and(...conditions));

  const total = summaryResult?.totalRequests ?? 0;
  const totalCost = parseFloat(summaryResult?.totalCost ?? '0');
  const totalTokens = (summaryResult?.totalInputTokens ?? 0) +
    (summaryResult?.totalOutputTokens ?? 0) +
    (summaryResult?.totalCacheCreationTokens ?? 0) +
    (summaryResult?.totalCacheReadTokens ?? 0);

  // 查询分页数据（使用 JOIN 获取用户名、密钥名、供应商名）
  const offset = (page - 1) * pageSize;
  const results = await db
    .select({
      id: messageRequest.id,
      createdAt: messageRequest.createdAt,
      userName: users.name,
      keyName: keysTable.name,
      providerName: providers.name,
      model: messageRequest.model,
      statusCode: messageRequest.statusCode,
      inputTokens: messageRequest.inputTokens,
      outputTokens: messageRequest.outputTokens,
      cacheCreationInputTokens: messageRequest.cacheCreationInputTokens,
      cacheReadInputTokens: messageRequest.cacheReadInputTokens,
      costUsd: messageRequest.costUsd,
      durationMs: messageRequest.durationMs,
      errorMessage: messageRequest.errorMessage,
      providerChain: messageRequest.providerChain,
    })
    .from(messageRequest)
    .innerJoin(users, eq(messageRequest.userId, users.id))
    .innerJoin(keysTable, eq(messageRequest.key, keysTable.key))
    .innerJoin(providers, eq(messageRequest.providerId, providers.id))
    .where(and(...conditions))
    .orderBy(desc(messageRequest.createdAt))
    .limit(pageSize)
    .offset(offset);

  const logs: UsageLogRow[] = results.map(row => {
    const totalRowTokens = (row.inputTokens ?? 0) +
      (row.outputTokens ?? 0) +
      (row.cacheCreationInputTokens ?? 0) +
      (row.cacheReadInputTokens ?? 0);

    return {
      ...row,
      totalTokens: totalRowTokens,
      costUsd: row.costUsd?.toString() ?? null,
      providerChain: row.providerChain as Array<{ id: number; name: string }> | null,
    };
  });

  return {
    logs,
    total,
    summary: {
      totalRequests: total,
      totalCost,
      totalTokens,
    }
  };
}

/**
 * 获取所有使用过的模型列表（用于筛选器）
 */
export async function getUsedModels(): Promise<string[]> {
  const results = await db
    .selectDistinct({ model: messageRequest.model })
    .from(messageRequest)
    .where(and(
      isNull(messageRequest.deletedAt),
      sql`${messageRequest.model} IS NOT NULL`
    ))
    .orderBy(messageRequest.model);

  return results.map(r => r.model).filter((m): m is string => m !== null);
}

/**
 * 获取所有使用过的状态码列表（用于筛选器）
 */
export async function getUsedStatusCodes(): Promise<number[]> {
  const results = await db
    .selectDistinct({ statusCode: messageRequest.statusCode })
    .from(messageRequest)
    .where(and(
      isNull(messageRequest.deletedAt),
      sql`${messageRequest.statusCode} IS NOT NULL`
    ))
    .orderBy(messageRequest.statusCode);

  return results.map(r => r.statusCode).filter((c): c is number => c !== null);
}
