import { NextRequest, NextResponse } from 'next/server';
import { executePgDump, checkDockerContainer } from '@/lib/database-backup/docker-executor';
import { logger } from '@/lib/logger';

const CONTAINER_NAME = process.env.POSTGRES_CONTAINER_NAME || 'claude-code-hub-db';
const DATABASE_NAME = process.env.DB_NAME || 'claude_code_hub';

/**
 * 导出数据库备份
 *
 * GET /api/admin/database/export
 *
 * 响应: application/octet-stream (pg_dump custom format)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证管理员权限
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token !== process.env.ADMIN_TOKEN) {
      logger.warn({ action: 'database_export_unauthorized' });
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 2. 检查 Docker 容器是否可用
    const isAvailable = await checkDockerContainer(CONTAINER_NAME);
    if (!isAvailable) {
      logger.error({
        action: 'database_export_container_unavailable',
        containerName: CONTAINER_NAME,
      });
      return NextResponse.json(
        { error: `Docker 容器 ${CONTAINER_NAME} 不可用，请确保使用 docker compose 部署` },
        { status: 503 }
      );
    }

    // 3. 执行 pg_dump
    const stream = executePgDump(CONTAINER_NAME, DATABASE_NAME);

    // 4. 生成文件名（带时间戳）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup_${timestamp}.dump`;

    logger.info({
      action: 'database_export_initiated',
      filename,
      databaseName: DATABASE_NAME,
    });

    // 5. 返回流式响应
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error({
      action: 'database_export_error',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: '导出数据库失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
