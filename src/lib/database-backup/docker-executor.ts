import { spawn } from "child_process";
import { createReadStream } from "fs";
import { logger } from "@/lib/logger";
import { getDatabaseConfig } from "./db-config";

/**
 * 执行 pg_dump 导出数据库
 *
 * @returns ReadableStream 数据流
 */
export function executePgDump(): ReadableStream<Uint8Array> {
  const dbConfig = getDatabaseConfig();

  const pgProcess = spawn(
    "pg_dump",
    [
      "-h",
      dbConfig.host,
      "-p",
      dbConfig.port.toString(),
      "-U",
      dbConfig.user,
      "-d",
      dbConfig.database,
      "-Fc", // Custom format (compressed)
      "-v", // Verbose
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: dbConfig.password,
      },
    }
  );

  logger.info({
    action: "pg_dump_start",
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
  });

  return new ReadableStream({
    start(controller) {
      // 监听 stdout (数据输出)
      pgProcess.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      // 监听 stderr (日志输出)
      pgProcess.stderr.on("data", (chunk: Buffer) => {
        logger.info(`[pg_dump] ${chunk.toString().trim()}`);
      });

      // 进程结束
      pgProcess.on("close", (code: number | null) => {
        if (code === 0) {
          logger.info({
            action: "pg_dump_complete",
            database: dbConfig.database,
          });
          controller.close();
        } else {
          const error = `pg_dump 失败，退出代码: ${code}`;
          logger.error({
            action: "pg_dump_error",
            database: dbConfig.database,
            exitCode: code,
          });
          controller.error(new Error(error));
        }
      });

      // 进程错误
      pgProcess.on("error", (err: Error) => {
        logger.error({
          action: "pg_dump_spawn_error",
          error: err.message,
        });
        controller.error(err);
      });
    },

    cancel() {
      pgProcess.kill();
      logger.warn({
        action: "pg_dump_cancelled",
        database: dbConfig.database,
      });
    },
  });
}

/**
 * 执行 pg_restore 导入数据库
 *
 * @param filePath 备份文件路径
 * @param cleanFirst 是否清除现有数据
 * @returns ReadableStream SSE 格式的进度流
 */
export function executePgRestore(filePath: string, cleanFirst: boolean): ReadableStream<Uint8Array> {
  const dbConfig = getDatabaseConfig();

  const args = [
    "-h",
    dbConfig.host,
    "-p",
    dbConfig.port.toString(),
    "-U",
    dbConfig.user,
    "-d",
    dbConfig.database,
    "-v", // Verbose（输出详细进度）
  ];

  // 覆盖模式：清除现有数据
  if (cleanFirst) {
    args.push("--clean", "--if-exists");
  }

  const pgProcess = spawn("pg_restore", args, {
    env: {
      ...process.env,
      PGPASSWORD: dbConfig.password,
    },
  });

  logger.info({
    action: "pg_restore_start",
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    cleanFirst,
    filePath,
  });

  // 将备份文件通过 stdin 传给 pg_restore
  const fileStream = createReadStream(filePath);
  fileStream.pipe(pgProcess.stdin);

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      // 监听 stderr（pg_restore 的进度信息都输出到 stderr）
      pgProcess.stderr.on("data", (chunk: Buffer) => {
        const message = chunk.toString().trim();
        logger.info(`[pg_restore] ${message}`);

        // 发送 SSE 格式的进度消息
        const sseMessage = `data: ${JSON.stringify({ type: "progress", message })}\n\n`;
        controller.enqueue(encoder.encode(sseMessage));
      });

      // 监听 stdout（一般为空，但为了完整性还是处理）
      pgProcess.stdout.on("data", (chunk: Buffer) => {
        const message = chunk.toString().trim();
        if (message) {
          logger.info(`[pg_restore stdout] ${message}`);
        }
      });

      // 进程结束
      pgProcess.on("close", (code: number | null) => {
        if (code === 0) {
          logger.info({
            action: "pg_restore_complete",
            database: dbConfig.database,
          });

          const completeMessage = `data: ${JSON.stringify({
            type: "complete",
            message: "数据导入成功！",
            exitCode: code,
          })}\n\n`;
          controller.enqueue(encoder.encode(completeMessage));
        } else {
          logger.error({
            action: "pg_restore_error",
            database: dbConfig.database,
            exitCode: code,
          });

          const errorMessage = `data: ${JSON.stringify({
            type: "error",
            message: `数据导入失败，退出代码: ${code}`,
            exitCode: code,
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        }

        controller.close();
      });

      // 进程错误
      pgProcess.on("error", (err: Error) => {
        logger.error({
          action: "pg_restore_spawn_error",
          error: err.message,
        });

        const errorMessage = `data: ${JSON.stringify({
          type: "error",
          message: `执行 pg_restore 失败: ${err.message}`,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMessage));
        controller.close();
      });
    },

    cancel() {
      pgProcess.kill();
      fileStream.destroy();
      logger.warn({
        action: "pg_restore_cancelled",
        database: dbConfig.database,
      });
    },
  });
}

/**
 * 获取数据库信息
 */
export async function getDatabaseInfo(): Promise<{
  size: string;
  tableCount: number;
  version: string;
}> {
  const dbConfig = getDatabaseConfig();

  return new Promise((resolve, reject) => {
    // 查询数据库大小和表数量
    const query = `
      SELECT
        pg_size_pretty(pg_database_size('${dbConfig.database}')) as size,
        (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as table_count,
        version() as version;
    `;

    const pgProcess = spawn(
      "psql",
      [
        "-h",
        dbConfig.host,
        "-p",
        dbConfig.port.toString(),
        "-U",
        dbConfig.user,
        "-d",
        dbConfig.database,
        "-t", // 不显示列名
        "-A", // 不对齐
        "-c",
        query,
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: dbConfig.password,
        },
      }
    );

    let output = "";
    let error = "";

    pgProcess.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    pgProcess.stderr.on("data", (chunk: Buffer) => {
      error += chunk.toString();
    });

    pgProcess.on("close", (code: number | null) => {
      if (code === 0) {
        const lines = output.trim().split("\n");
        if (lines.length > 0) {
          const [size, tableCount, version] = lines[0].split("|");
          resolve({
            size: size?.trim() || "Unknown",
            tableCount: parseInt(tableCount?.trim() || "0", 10),
            version: version?.trim().split(" ")[0] || "Unknown",
          });
        } else {
          reject(new Error("未能获取数据库信息"));
        }
      } else {
        reject(new Error(error || `查询失败，退出代码: ${code}`));
      }
    });

    pgProcess.on("error", (err: Error) => {
      reject(err);
    });
  });
}

/**
 * 检查数据库连接是否可用
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  const dbConfig = getDatabaseConfig();

  return new Promise((resolve) => {
    const pgProcess = spawn(
      "pg_isready",
      ["-h", dbConfig.host, "-p", dbConfig.port.toString(), "-U", dbConfig.user, "-d", dbConfig.database],
      {
        env: {
          ...process.env,
          PGPASSWORD: dbConfig.password,
        },
      }
    );

    pgProcess.on("close", (code: number | null) => {
      resolve(code === 0);
    });

    pgProcess.on("error", () => {
      resolve(false);
    });
  });
}
