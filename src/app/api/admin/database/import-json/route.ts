import { db } from "@/drizzle/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  users as usersTable,
  keys as keysTable,
  providers as providersTable,
  messageRequest as messageRequestTable,
  modelPrices as modelPricesTable,
  sensitiveWords as sensitiveWordsTable,
  systemSettings as systemSettingsTable
} from "@/drizzle/schema";

// 导入模式类型
export type ImportMode = "full" | "data" | "schema" | "selective";

// 导入数据记录接口
interface ImportDataRecord {
  [key: string]: string | number | boolean | Date | null | undefined;
}

// 导入配置接口
interface ImportConfig {
  mode: ImportMode;
  tables?: string[];
  skipExisting?: boolean; // 跳过已存在的记录
  truncateExisting?: boolean; // 导入前清空现有数据
  validateData?: boolean; // 验证数据完整性
  batchSize?: number; // 批量插入大小
}

// 导入结果接口
interface ImportResult {
  success: boolean;
  summary: {
    totalTables: number;
    processedTables: string[];
    totalImported: number;
    totalSkipped: number;
    totalErrors: number;
    errors: Array<{
      table: string;
      error: string;
      details?: unknown;
    }>;
  };
  details: {
    [tableName: string]: {
      imported: number;
      skipped: number;
      errors: number;
      errorDetails?: string[];
    };
  };
}

// 导入数据结构接口
interface DatabaseImport {
  version: string;
  exportedAt: string;
  exportedBy: string;
  config: ImportConfig;
  tables: {
    [tableName: string]: {
      schema: string[];
      data?: ImportDataRecord[];
      metadata: {
        count: number;
        columns: Array<{
          name: string;
          type: string;
          nullable: boolean;
          default?: string;
        }>;
      };
    };
  };
  summary: {
    totalTables: number;
    totalRecords: number;
    exportedTables: string[];
  };
}

/**
 * JSON 导入数据库
 *
 * POST /api/admin/database/import-json
 *
 * Body: {
 *   data: DatabaseImport,  // JSON 导入数据
 *   config: {
 *     mode: "full" | "data" | "schema" | "selective",
 *     tables?: string[],
 *     skipExisting?: boolean,
 *     truncateExisting?: boolean,
 *     validateData?: boolean,
 *     batchSize?: number
 *   }
 * }
 *
 * 响应: ImportResult
 */
export async function POST(request: Request) {
  try {
    // 1. 验证管理员权限
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      logger.warn({ action: "database_import_json_unauthorized" });
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. 解析请求数据
    const requestData = await request.json();
    const importData: DatabaseImport = requestData.data;
    const config: ImportConfig = requestData.config || {
      mode: "full",
      skipExisting: false,
      truncateExisting: false,
      validateData: true,
      batchSize: 1000,
    };

    // 3. 验证导入数据
    const validationResult = validateImportData(importData, config);
    if (!validationResult.valid) {
      return Response.json(
        {
          error: "Invalid import data",
          details: validationResult.errors
        },
        { status: 400 }
      );
    }

    logger.info({
      action: "database_import_json_initiated",
      mode: config.mode,
      tables: config.tables,
      sourceVersion: importData.version,
      sourceExportedAt: importData.exportedAt,
      totalTables: Object.keys(importData.tables).length,
      user: session.user.name,
    });

    // 4. 初始化导入结果
    const result: ImportResult = {
      success: true,
      summary: {
        totalTables: 0,
        processedTables: [],
        totalImported: 0,
        totalSkipped: 0,
        totalErrors: 0,
        errors: [],
      },
      details: {},
    };

    // 5. 定义可导入的表
    const importableTables = {
      users: usersTable,
      keys: keysTable,
      providers: providersTable,
      messageRequest: messageRequestTable,
      modelPrices: modelPricesTable,
      sensitiveWords: sensitiveWordsTable,
      systemSettings: systemSettingsTable,
    };

    // 6. 确定要导入的表
    let tablesToImport = Object.keys(importData.tables);
    if (config.mode === "selective" && config.tables) {
      tablesToImport = tablesToImport.filter(table => config.tables!.includes(table));
    }

    result.summary.totalTables = tablesToImport.length;

    // 7. 使用事务导入数据
    await db.transaction(async (tx) => {
      for (const tableName of tablesToImport) {
        const tableData = importData.tables[tableName];
        const table = importableTables[tableName as keyof typeof importableTables];

        if (!table || !tableData) {
          result.summary.errors.push({
            table: tableName,
            error: "Table not found in import data or not importable",
          });
          result.summary.totalErrors++;
          continue;
        }

        try {
          // 初始化表统计
          result.details[tableName] = {
            imported: 0,
            skipped: 0,
            errors: 0,
            errorDetails: [],
          };

          // 如果需要，清空现有数据
          if (config.truncateExisting) {
            await tx.delete(table);
            logger.info({ action: "database_import_json_table_truncated", table: tableName });
          }

          // 如果是数据模式且没有数据，跳过
          if (config.mode === "data" && !tableData.data) {
            logger.info({ action: "database_import_json_table_no_data", table: tableName });
            continue;
          }

          // 导入数据
          if (tableData.data && tableData.data.length > 0) {
            await importTableData(
              tx,
              tableName,
              table,
              tableData.data,
              config,
              result
            );
          }

          // 记录成功处理的表
          result.summary.processedTables.push(tableName);

          logger.info({
            action: "database_import_json_table_completed",
            table: tableName,
            imported: result.details[tableName].imported,
            skipped: result.details[tableName].skipped,
            errors: result.details[tableName].errors,
          });

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          result.details[tableName].errors++;
          result.details[tableName].errorDetails?.push(errorMsg);

          result.summary.errors.push({
            table: tableName,
            error: errorMsg,
            details: error,
          });
          result.summary.totalErrors++;

          logger.error({
            action: "database_import_json_table_error",
            table: tableName,
            error: errorMsg,
          });
        }
      }
    });

    // 8. 判断整体成功状态
    result.success = result.summary.totalErrors === 0;

    logger.info({
      action: "database_import_json_completed",
      success: result.success,
      totalTables: result.summary.totalTables,
      processedTables: result.summary.processedTables.length,
      totalImported: result.summary.totalImported,
      totalSkipped: result.summary.totalSkipped,
      totalErrors: result.summary.totalErrors,
      user: session.user.name,
    });

    // 9. 返回结果
    const statusCode = result.success ? 200 : 207; // 207 Multi-Status for partial success
    return Response.json(result, { status: statusCode });

  } catch (error) {
    logger.error({
      action: "database_import_json_error",
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        success: false,
        error: "导入 JSON 数据失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 验证导入数据
 */
function validateImportData(
  importData: DatabaseImport,
  config: ImportConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 检查基本结构
  if (!importData.version) {
    errors.push("Missing version information");
  }

  if (!importData.tables || typeof importData.tables !== "object") {
    errors.push("Missing or invalid tables data");
  }

  if (!importData.summary) {
    errors.push("Missing summary information");
  }

  // 检查模式兼容性
  if (config.mode === "selective" && (!config.tables || config.tables.length === 0)) {
    errors.push("Selective mode requires table selection");
  }

  // 检查每个表的数据结构
  if (importData.tables) {
    for (const [tableName, tableData] of Object.entries(importData.tables)) {
      if (!tableData.schema || !Array.isArray(tableData.schema)) {
        errors.push(`Invalid schema for table: ${tableName}`);
      }

      if (!tableData.metadata || !tableData.metadata.columns) {
        errors.push(`Missing metadata for table: ${tableName}`);
      }

      if (config.mode !== "schema" && tableData.data && !Array.isArray(tableData.data)) {
        errors.push(`Invalid data format for table: ${tableName}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 导入表数据
 */
async function importTableData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tableName: string,
  table: unknown,
  data: ImportDataRecord[],
  config: ImportConfig,
  result: ImportResult
): Promise<void> {
  const batchSize = config.batchSize || 1000;
  const tableDetails = result.details[tableName];

  // 预处理数据：转换日期字符串、处理特殊字段等
  const processedData = data.map((record: ImportDataRecord) => preprocessRecord(tableName, record));

  // 批量插入
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);

    try {
      await tx.insert(table).values(batch);
      tableDetails.imported += batch.length;
      result.summary.totalImported += batch.length;

      logger.debug({
        action: "database_import_json_batch_imported",
        table: tableName,
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      tableDetails.errors++;
      tableDetails.errorDetails?.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errorMsg}`);
      result.summary.totalErrors++;

      logger.error({
        action: "database_import_json_batch_error",
        table: tableName,
        batchIndex: Math.floor(i / batchSize) + 1,
        error: errorMsg,
      });

      // 对于批量插入错误，尝试逐条插入
      for (const record of batch) {
        try {
          await tx.insert(table).values(record);
          tableDetails.imported++;
          result.summary.totalImported++;
        } catch (singleError) {
          const singleErrorMsg = singleError instanceof Error ? singleError.message : String(singleError);
          tableDetails.errors++;
          tableDetails.errorDetails?.push(singleErrorMsg);
          result.summary.totalErrors++;

          logger.debug({
            action: "database_import_json_record_error",
            table: tableName,
            recordId: record.id || 'unknown',
            error: singleErrorMsg,
          });
        }
      }
    }
  }
}

/**
 * 预处理记录数据
 */
function preprocessRecord(
  tableName: string,
  record: ImportDataRecord,
): ImportDataRecord {
  const processed = { ...record } as ImportDataRecord;

  // 移除不应该导入的字段（如自增 ID）
  if (processed.id !== undefined) {
    // 对于某些表，可能需要保留 ID（如 messages 表）
    const keepIdTables = ["messageRequest"];
    if (!keepIdTables.includes(tableName)) {
      delete processed.id;
    }
  }

  // 转换日期字符串为 Date 对象
  const dateFields = ["createdAt", "updatedAt", "expiresAt", "deletedAt"];
  for (const field of dateFields) {
    if (processed[field] && typeof processed[field] === "string") {
      const dateValue = new Date(processed[field]);
      if (!isNaN(dateValue.getTime())) {
        processed[field] = dateValue;
      }
    }
  }

  // 处理数值字段
  if (processed.rpmLimit !== undefined) {
    processed.rpmLimit = Number(processed.rpmLimit);
  }
  if (processed.weight !== undefined) {
    processed.weight = Number(processed.weight);
  }
  if (processed.priority !== undefined) {
    processed.priority = Number(processed.priority);
  }
  if (processed.costMultiplier !== undefined) {
    processed.costMultiplier = Number(processed.costMultiplier);
  }
  if (processed.limitConcurrentSessions !== undefined) {
    processed.limitConcurrentSessions = Number(processed.limitConcurrentSessions);
  }

  // 处理布尔字段
  const booleanFields = ["isEnabled", "canLoginWebUi"];
  for (const field of booleanFields) {
    if (processed[field] !== undefined) {
      processed[field] = Boolean(processed[field]);
    }
  }

  // 处理 JSON 字段
  const jsonFields = ["modelRedirects", "allowedModels"];
  for (const field of jsonFields) {
    if (processed[field] !== undefined) {
      // 确保是有效的 JSON 字符串或对象
      if (typeof processed[field] === "string") {
        try {
          processed[field] = JSON.parse(processed[field]);
        } catch {
          // 如果解析失败，保持原样
        }
      }
    }
  }

  return processed;
}