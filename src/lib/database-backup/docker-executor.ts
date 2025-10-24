import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createReadStream } from 'fs';
import { logger } from '@/lib/logger';

/**
 * 检查 Docker 容器是否可用
 */
export async function checkDockerContainer(containerName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('docker', ['inspect', containerName]);

    process.on('close', (code) => {
      resolve(code === 0);
    });

    process.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * 执行 pg_dump 导出数据库
 *
 * @param containerName Docker 容器名称
 * @param databaseName 数据库名称
 * @returns ReadableStream 数据流
 */
export function executePgDump(
  containerName: string,
  databaseName: string
): ReadableStream<Uint8Array> {
  const process = spawn('docker', [
    'exec',
    containerName,
    'pg_dump',
    '-Fc', // Custom format (compressed)
    '-v',  // Verbose
    '-d',
    databaseName,
  ]);

  logger.info({
    action: 'pg_dump_start',
    containerName,
    databaseName,
  });

  return new ReadableStream({
    start(controller) {
      // 监听 stdout (数据输出)
      process.stdout.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      // 监听 stderr (日志输出)
      process.stderr.on('data', (chunk: Buffer) => {
        logger.info(`[pg_dump] ${chunk.toString().trim()}`);
      });

      // 进程结束
      process.on('close', (code) => {
        if (code === 0) {
          logger.info({
            action: 'pg_dump_complete',
            containerName,
            databaseName,
          });
          controller.close();
        } else {
          const error = `pg_dump 失败，退出代码: ${code}`;
          logger.error({
            action: 'pg_dump_error',
            containerName,
            databaseName,
            exitCode: code,
          });
          controller.error(new Error(error));
        }
      });

      // 进程错误
      process.on('error', (err) => {
        logger.error({
          action: 'pg_dump_spawn_error',
          error: err.message,
        });
        controller.error(err);
      });
    },

    cancel() {
      process.kill();
      logger.warn({
        action: 'pg_dump_cancelled',
        containerName,
        databaseName,
      });
    },
  });
}

/**
 * 执行 pg_restore 导入数据库
 *
 * @param containerName Docker 容器名称
 * @param databaseName 数据库名称
 * @param filePath 备份文件路径
 * @param cleanFirst 是否清除现有数据
 * @returns ReadableStream SSE 格式的进度流
 */
export function executePgRestore(
  containerName: string,
  databaseName: string,
  filePath: string,
  cleanFirst: boolean
): ReadableStream<Uint8Array> {
  const args = [
    'exec',
    '-i', // 交互模式（接收 stdin）
    containerName,
    'pg_restore',
    '-v', // Verbose（输出详细进度）
    '-d',
    databaseName,
  ];

  // 覆盖模式：清除现有数据
  if (cleanFirst) {
    args.push('--clean', '--if-exists');
  }

  const process = spawn('docker', args);

  logger.info({
    action: 'pg_restore_start',
    containerName,
    databaseName,
    cleanFirst,
    filePath,
  });

  // 将备份文件通过 stdin 传给 pg_restore
  const fileStream = createReadStream(filePath);
  fileStream.pipe(process.stdin);

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      // 监听 stderr（pg_restore 的进度信息都输出到 stderr）
      process.stderr.on('data', (chunk: Buffer) => {
        const message = chunk.toString().trim();
        logger.info(`[pg_restore] ${message}`);

        // 发送 SSE 格式的进度消息
        const sseMessage = `data: ${JSON.stringify({ type: 'progress', message })}\n\n`;
        controller.enqueue(encoder.encode(sseMessage));
      });

      // 监听 stdout（一般为空，但为了完整性还是处理）
      process.stdout.on('data', (chunk: Buffer) => {
        const message = chunk.toString().trim();
        if (message) {
          logger.info(`[pg_restore stdout] ${message}`);
        }
      });

      // 进程结束
      process.on('close', (code) => {
        if (code === 0) {
          logger.info({
            action: 'pg_restore_complete',
            containerName,
            databaseName,
          });

          const completeMessage = `data: ${JSON.stringify({
            type: 'complete',
            message: '数据导入成功！',
            exitCode: code
          })}\n\n`;
          controller.enqueue(encoder.encode(completeMessage));
        } else {
          logger.error({
            action: 'pg_restore_error',
            containerName,
            databaseName,
            exitCode: code,
          });

          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            message: `数据导入失败，退出代码: ${code}`,
            exitCode: code
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        }

        controller.close();
      });

      // 进程错误
      process.on('error', (err) => {
        logger.error({
          action: 'pg_restore_spawn_error',
          error: err.message,
        });

        const errorMessage = `data: ${JSON.stringify({
          type: 'error',
          message: `执行 pg_restore 失败: ${err.message}`
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMessage));
        controller.close();
      });
    },

    cancel() {
      process.kill();
      fileStream.destroy();
      logger.warn({
        action: 'pg_restore_cancelled',
        containerName,
        databaseName,
      });
    },
  });
}

/**
 * 获取数据库信息
 */
export async function getDatabaseInfo(
  containerName: string,
  databaseName: string
): Promise<{
  size: string;
  tableCount: number;
  version: string;
}> {
  return new Promise((resolve, reject) => {
    // 查询数据库大小和表数量
    const query = `
      SELECT
        pg_size_pretty(pg_database_size('${databaseName}')) as size,
        (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as table_count,
        version() as version;
    `;

    const process = spawn('docker', [
      'exec',
      containerName,
      'psql',
      '-U',
      'postgres',
      '-d',
      databaseName,
      '-t', // 不显示列名
      '-A', // 不对齐
      '-c',
      query,
    ]);

    let output = '';
    let error = '';

    process.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    process.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        const lines = output.trim().split('\n');
        if (lines.length > 0) {
          const [size, tableCount, version] = lines[0].split('|');
          resolve({
            size: size?.trim() || 'Unknown',
            tableCount: parseInt(tableCount?.trim() || '0', 10),
            version: version?.trim().split(' ')[0] || 'Unknown',
          });
        } else {
          reject(new Error('未能获取数据库信息'));
        }
      } else {
        reject(new Error(error || `查询失败，退出代码: ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}
