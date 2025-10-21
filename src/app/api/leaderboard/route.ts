import { NextRequest, NextResponse } from "next/server";
import { findDailyLeaderboard, findMonthlyLeaderboard } from "@/repository/leaderboard";
import { unstable_cache } from "next/cache";

/**
 * 获取排行榜数据
 * GET /api/leaderboard?period=daily|monthly
 *
 * 无需认证，公开访问
 * 缓存时间：5 分钟
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "daily";

    // 验证参数
    if (period !== "daily" && period !== "monthly") {
      return NextResponse.json(
        { error: "参数 period 必须是 'daily' 或 'monthly'" },
        { status: 400 }
      );
    }

    // 生成缓存 key（包含日期以确保每天/每月自动刷新）
    const now = new Date();
    const cacheKey = period === "daily"
      ? `leaderboard:daily:${now.toISOString().split('T')[0]}`
      : `leaderboard:monthly:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 使用 Next.js unstable_cache 进行缓存
    const getCachedLeaderboard = unstable_cache(
      async () => {
        if (period === "daily") {
          return await findDailyLeaderboard();
        } else {
          return await findMonthlyLeaderboard();
        }
      },
      [cacheKey],
      {
        revalidate: 300, // 5 分钟缓存
        tags: [`leaderboard-${period}`]
      }
    );

    const data = await getCachedLeaderboard();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error("获取排行榜失败:", error);
    return NextResponse.json(
      { error: "获取排行榜数据失败" },
      { status: 500 }
    );
  }
}
