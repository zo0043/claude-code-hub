import { writeFile, unlink } from "fs/promises";
import { executePgRestore, checkDatabaseConnection } from "@/lib/database-backup/docker-executor";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/auth";

/**
 * 导入数据库备份
 *
 * POST /api/admin/database/import
 *
 * Body: multipart/form-data
 *   - file: 备份文件 (.dump)
 *   - cleanFirst: 'true' | 'false' (是否清除现有数据)
 *
 * 响应: text/event-stream (SSE 格式的进度流)
 */
export async function POST(request: Request) {
  let tempFilePath: string | null = null;

  try {
    // 1. 验证管理员权限
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      logger.warn({ action: "database_import_unauthorized" });
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. 检查数据库连接
    const isAvailable = await checkDatabaseConnection();
    if (!isAvailable) {
      logger.error({
        action: "database_import_connection_unavailable",
      });
      return Response.json(
        { error: "数据库连接不可用，请检查数据库服务状态" },
        { status: 503 }
      );
    }

    // 3. 解析表单数据
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cleanFirst = formData.get("cleanFirst") === "true";

    if (!file) {
      return Response.json({ error: "缺少备份文件" }, { status: 400 });
    }

    // 4. 验证文件类型
    if (!file.name.endsWith(".dump")) {
      return Response.json({ error: "文件格式错误，仅支持 .dump 格式的备份文件" }, { status: 400 });
    }

    logger.info({
      action: "database_import_initiated",
      filename: file.name,
      fileSize: file.size,
      cleanFirst,
    });

    // 5. 保存上传文件到临时目录
    tempFilePath = `/tmp/restore_${Date.now()}.dump`;
    const bytes = await file.arrayBuffer();
    await writeFile(tempFilePath, Buffer.from(bytes));

    logger.info({
      action: "database_import_file_saved",
      tempFilePath,
    });

    // 6. 执行 pg_restore，返回 SSE 流
    const stream = executePgRestore(tempFilePath, cleanFirst);

    // 7. 清理临时文件的逻辑（在流结束后执行）
    const cleanupStream = new TransformStream({
      flush() {
        if (tempFilePath) {
          unlink(tempFilePath)
            .then(() => {
              logger.info({
                action: "database_import_temp_file_cleaned",
                tempFilePath,
              });
            })
            .catch((err) => {
              logger.error({
                action: "database_import_temp_file_cleanup_error",
                tempFilePath,
                error: err.message,
              });
            });
        }
      },
    });

    // 8. 返回 SSE 流式响应
    return new Response(stream.pipeThrough(cleanupStream), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error({
      action: "database_import_error",
      error: error instanceof Error ? error.message : String(error),
    });

    // 出错时清理临时文件
    if (tempFilePath) {
      unlink(tempFilePath).catch((err) => {
        logger.error({
          action: "database_import_temp_file_cleanup_error",
          tempFilePath,
          error: err.message,
        });
      });
    }

    return Response.json(
      {
        error: "导入数据库失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
