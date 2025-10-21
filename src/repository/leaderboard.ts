"use server";

import { db } from "@/drizzle/db";
import { messageRequest, users } from "@/drizzle/schema";
import { and, gte, lte, desc, sql, isNull } from "drizzle-orm";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

/**
 * 排行榜条目类型
 */
export interface LeaderboardEntry {
  userId: number;
  userName: string;
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
}

/**
 * 查询今日消耗排行榜（Top 50）
 */
export async function findDailyLeaderboard(): Promise<LeaderboardEntry[]> {
  const today = new Date();
  const startTime = startOfDay(today);
  const endTime = endOfDay(today);

  return findLeaderboard(startTime, endTime);
}

/**
 * 查询本月消耗排行榜（Top 50）
 */
export async function findMonthlyLeaderboard(): Promise<LeaderboardEntry[]> {
  const today = new Date();
  const startTime = startOfMonth(today);
  const endTime = endOfMonth(today);

  return findLeaderboard(startTime, endTime);
}

/**
 * 通用排行榜查询函数
 */
async function findLeaderboard(
  startTime: Date,
  endTime: Date
): Promise<LeaderboardEntry[]> {
  const rankings = await db
    .select({
      userId: messageRequest.userId,
      userName: users.name,
      totalRequests: sql<number>`count(*)::int`,
      totalCost: sql<string>`COALESCE(sum(${messageRequest.costUsd}), 0)`,
      totalTokens: sql<number>`COALESCE(
        sum(
          ${messageRequest.inputTokens} +
          ${messageRequest.outputTokens} +
          COALESCE(${messageRequest.cacheCreationInputTokens}, 0) +
          COALESCE(${messageRequest.cacheReadInputTokens}, 0)
        ), 0
      )::int`,
    })
    .from(messageRequest)
    .innerJoin(users, and(
      sql`${messageRequest.userId} = ${users.id}`,
      isNull(users.deletedAt)
    ))
    .where(
      and(
        isNull(messageRequest.deletedAt),
        gte(messageRequest.createdAt, startTime),
        lte(messageRequest.createdAt, endTime)
      )
    )
    .groupBy(messageRequest.userId, users.name)
    .orderBy(desc(sql`sum(${messageRequest.costUsd})`))
    .limit(50);

  // 将 totalCost 从字符串转为数字
  return rankings.map((entry) => ({
    userId: entry.userId,
    userName: entry.userName,
    totalRequests: entry.totalRequests,
    totalCost: parseFloat(entry.totalCost),
    totalTokens: entry.totalTokens,
  }));
}
