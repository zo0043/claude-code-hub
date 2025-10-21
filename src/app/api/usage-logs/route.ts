import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findUsageLogs } from "@/repository/message";

/**
 * 获取使用日志
 * GET /api/usage-logs
 *
 * 查询参数：
 * - page: 页码（默认 1）
 * - pageSize: 每页条数（默认 50，最大 100）
 * - startDate: 开始日期（ISO 8601 格式）
 * - endDate: 结束日期（ISO 8601 格式）
 * - model: 模型名称筛选
 * - userId: 用户 ID 筛选（仅 admin 可用）
 *
 * 权限：
 * - 普通用户只能查看自己的使用记录
 * - admin 用户可以查看所有用户的记录
 *
 * 响应格式：
 * {
 *   logs: [...],
 *   total: number,
 *   page: number,
 *   pageSize: number,
 *   totalPages: number
 * }
 */
export async function GET(request: Request) {
  try {
    // 验证用户登录
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "未授权，请先登录" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") || "50", 10),
      100 // 最大 100 条
    );

    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const model = searchParams.get("model") || undefined;
    const userIdParam = searchParams.get("userId");

    // 解析日期
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // 权限控制：普通用户只能查看自己的记录
    let targetUserId: number | undefined;
    if (session.user.role === "admin") {
      // admin 可以指定 userId 或查看所有
      targetUserId = userIdParam ? parseInt(userIdParam, 10) : undefined;
    } else {
      // 普通用户只能查看自己的
      targetUserId = session.user.id;
    }

    // 查询日志
    const { logs, total } = await findUsageLogs({
      userId: targetUserId,
      startDate,
      endDate,
      model,
      page,
      pageSize
    });

    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages
    });
  } catch (error) {
    console.error("Failed to fetch usage logs:", error);
    return NextResponse.json(
      { error: "获取使用日志失败" },
      { status: 500 }
    );
  }
}
