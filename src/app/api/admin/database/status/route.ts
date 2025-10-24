import { checkDockerContainer, getDatabaseInfo } from "@/lib/database-backup/docker-executor";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/auth";
import type { DatabaseStatus } from "@/types/database-backup";

const CONTAINER_NAME = process.env.POSTGRES_CONTAINER_NAME || "claude-code-hub-db";
const DATABASE_NAME = process.env.DB_NAME || "claude_code_hub";

/**
 * 获取数据库状态信息
 *
 * GET /api/admin/database/status
 *
 * 响应: DatabaseStatus JSON
 */
export async function GET() {
  try {
    // 1. 验证管理员权限
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      logger.warn({ action: "database_status_unauthorized" });
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. 检查 Docker 容器是否可用
    const isAvailable = await checkDockerContainer(CONTAINER_NAME);

    if (!isAvailable) {
      const status: DatabaseStatus = {
        isAvailable: false,
        containerName: CONTAINER_NAME,
        databaseName: DATABASE_NAME,
        databaseSize: "N/A",
        tableCount: 0,
        postgresVersion: "N/A",
        error: `Docker 容器 ${CONTAINER_NAME} 不可用，请确保使用 docker compose 部署`,
      };

      logger.warn({
        action: "database_status_container_unavailable",
        containerName: CONTAINER_NAME,
      });

      return Response.json(status, { status: 200 });
    }

    // 3. 获取数据库详细信息
    try {
      const info = await getDatabaseInfo(CONTAINER_NAME, DATABASE_NAME);

      const status: DatabaseStatus = {
        isAvailable: true,
        containerName: CONTAINER_NAME,
        databaseName: DATABASE_NAME,
        databaseSize: info.size,
        tableCount: info.tableCount,
        postgresVersion: info.version,
      };

      logger.info({
        action: "database_status_retrieved",
        ...status,
      });

      return Response.json(status, { status: 200 });
    } catch (infoError) {
      const status: DatabaseStatus = {
        isAvailable: true,
        containerName: CONTAINER_NAME,
        databaseName: DATABASE_NAME,
        databaseSize: "Unknown",
        tableCount: 0,
        postgresVersion: "Unknown",
        error: infoError instanceof Error ? infoError.message : String(infoError),
      };

      logger.error({
        action: "database_status_info_error",
        error: infoError instanceof Error ? infoError.message : String(infoError),
      });

      return Response.json(status, { status: 200 });
    }
  } catch (error) {
    logger.error({
      action: "database_status_error",
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        error: "获取数据库状态失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
