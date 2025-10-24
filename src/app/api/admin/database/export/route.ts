import { executePgDump, checkDatabaseConnection } from "@/lib/database-backup/docker-executor";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/auth";

/**
 * 导出数据库备份
 *
 * GET /api/admin/database/export
 *
 * 响应: application/octet-stream (pg_dump custom format)
 */
export async function GET() {
  try {
    // 1. 验证管理员权限
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      logger.warn({ action: "database_export_unauthorized" });
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. 检查数据库连接
    const isAvailable = await checkDatabaseConnection();
    if (!isAvailable) {
      logger.error({
        action: "database_export_connection_unavailable",
      });
      return Response.json(
        { error: "数据库连接不可用，请检查数据库服务状态" },
        { status: 503 }
      );
    }

    // 3. 执行 pg_dump
    const stream = executePgDump();

    // 4. 生成文件名（带时间戳）
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `backup_${timestamp}.dump`;

    logger.info({
      action: "database_export_initiated",
      filename,
    });

    // 5. 返回流式响应
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    logger.error({
      action: "database_export_error",
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        error: "导出数据库失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
