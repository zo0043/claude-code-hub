import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { executePgRestore, checkDockerContainer } from '@/lib/database-backup/docker-executor';
import { logger } from '@/lib/logger';

const CONTAINER_NAME = process.env.POSTGRES_CONTAINER_NAME || 'claude-code-hub-db';
const DATABASE_NAME = process.env.DB_NAME || 'claude_code_hub';

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
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // 1. 验证管理员权限
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token !== process.env.ADMIN_TOKEN) {
      logger.warn({ action: 'database_import_unauthorized' });
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 2. 检查 Docker 容器是否可用
    const isAvailable = await checkDockerContainer(CONTAINER_NAME);
    if (!isAvailable) {
      logger.error({
        action: 'database_import_container_unavailable',
        containerName: CONTAINER_NAME,
      });
      return NextResponse.json(
        { error: `Docker 容器 ${CONTAINER_NAME} 不可用，请确保使用 docker compose 部署` },
        { status: 503 }
      );
    }

    // 3. 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cleanFirst = formData.get('cleanFirst') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: '缺少备份文件' },
        { status: 400 }
      );
    }

    // 4. 验证文件类型
    if (!file.name.endsWith('.dump')) {
      return NextResponse.json(
        { error: '文件格式错误，仅支持 .dump 格式的备份文件' },
        { status: 400 }
      );
    }

    logger.info({
      action: 'database_import_initiated',
      filename: file.name,
      fileSize: file.size,
      cleanFirst,
      databaseName: DATABASE_NAME,
    });

    // 5. 保存上传文件到临时目录
    tempFilePath = `/tmp/restore_${Date.now()}.dump`;
    const bytes = await file.arrayBuffer();
    await writeFile(tempFilePath, Buffer.from(bytes));

    logger.info({
      action: 'database_import_file_saved',
      tempFilePath,
    });

    // 6. 执行 pg_restore，返回 SSE 流
    const stream = executePgRestore(
      CONTAINER_NAME,
      DATABASE_NAME,
      tempFilePath,
      cleanFirst
    );

    // 7. 清理临时文件的逻辑（在流结束后执行）
    const cleanupStream = new TransformStream({
      flush() {
        if (tempFilePath) {
          unlink(tempFilePath)
            .then(() => {
              logger.info({
                action: 'database_import_temp_file_cleaned',
                tempFilePath,
              });
            })
            .catch((err) => {
              logger.error({
                action: 'database_import_temp_file_cleanup_error',
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
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error({
      action: 'database_import_error',
      error: error instanceof Error ? error.message : String(error),
    });

    // 出错时清理临时文件
    if (tempFilePath) {
      unlink(tempFilePath).catch((err) => {
        logger.error({
          action: 'database_import_temp_file_cleanup_error',
          tempFilePath,
          error: err.message,
        });
      });
    }

    return NextResponse.json(
      {
        error: '导入数据库失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
