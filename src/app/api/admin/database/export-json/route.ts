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
import { isNull } from "drizzle-orm";

// 导出模式类型
export type ExportMode = "full" | "schema" | "data" | "selective";

// 数据记录接口
interface DataRecord {
  [key: string]: string | number | boolean | Date | null | undefined;
}

// 导出配置接口
interface ExportConfig {
  mode: ExportMode;
  tables?: string[];
  includeSensitiveData?: boolean;
  maxRecords?: number; // 限制导出记录数，用于测试
}

// 列信息接口
interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
}

// 表元数据接口
interface TableMetadata {
  count: number;
  columns: ColumnInfo[];
}

// 完整导出结构接口
interface DatabaseExport {
  version: string;
  exportedAt: string;
  exportedBy: string;
  config: ExportConfig;
  tables: {
    [tableName: string]: {
      schema: string[];
      data?: DataRecord[];
      metadata: TableMetadata;
    };
  };
  summary: {
    totalTables: number;
    totalRecords: number;
    exportedTables: string[];
  };
}

/**
 * JSON 导出数据库
 *
 * POST /api/admin/database/export-json
 *
 * Body: {
 *   mode: "full" | "schema" | "data" | "selective",
 *   tables?: string[],
 *   includeSensitiveData?: boolean,
 *   maxRecords?: number
 * }
 *
 * 响应: application/json (完整的数据库 JSON)
 */
export async function POST(request: Request) {
  try {
    // 1. 验证管理员权限
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      logger.warn({ action: "database_export_json_unauthorized" });
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. 解析请求配置
    const config: ExportConfig = await request.json();

    // 验证配置
    if (!["full", "schema", "data", "selective"].includes(config.mode)) {
      return Response.json(
        { error: "Invalid export mode" },
        { status: 400 }
      );
    }

    if (config.mode === "selective" && (!config.tables || config.tables.length === 0)) {
      return Response.json(
        { error: "Selective mode requires table selection" },
        { status: 400 }
      );
    }

    logger.info({
      action: "database_export_json_initiated",
      mode: config.mode,
      tables: config.tables,
      includeSensitiveData: config.includeSensitiveData,
      user: session.user.name,
    });

    // 3. 定义可导出的表
    const exportableTables = {
      users: usersTable,
      keys: keysTable,
      providers: providersTable,
      messageRequest: messageRequestTable,
      modelPrices: modelPricesTable,
      sensitiveWords: sensitiveWordsTable,
      systemSettings: systemSettingsTable,
    };

    // 4. 确定要导出的表
    let tablesToExport = Object.keys(exportableTables);
    if (config.mode === "selective" && config.tables) {
      tablesToExport = tablesToExport.filter(table => config.tables!.includes(table));
    }

    // 5. 开始导出
    const exportData: DatabaseExport = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      exportedBy: session.user.name,
      config,
      tables: {},
      summary: {
        totalTables: tablesToExport.length,
        totalRecords: 0,
        exportedTables: tablesToExport,
      },
    };

    // 6. 导出每个表
    for (const tableName of tablesToExport) {
      const table = exportableTables[tableName as keyof typeof exportableTables];

      try {
        // 获取表结构（列信息）
        const columns = await getTableColumns(tableName);

        // 获取数据（如果需要）
        let data: DataRecord[] = [];
        if (config.mode !== "schema") {
          data = await exportTableData(table, tableName, config);
        }

        // 构建表导出数据
        exportData.tables[tableName] = {
          schema: columns.map(col => col.name),
          data: config.mode === "schema" ? undefined : data,
          metadata: {
            count: data.length,
            columns,
          },
        };

        exportData.summary.totalRecords += data.length;

        logger.debug({
          action: "database_export_json_table_completed",
          table: tableName,
          recordCount: data.length,
        });

      } catch (error) {
        logger.error({
          action: "database_export_json_table_error",
          table: tableName,
          error: error instanceof Error ? error.message : String(error),
        });

        // 继续导出其他表，记录错误
        exportData.tables[tableName] = {
          schema: [],
          data: [],
          metadata: {
            count: 0,
            columns: [],
          },
        };
      }
    }

    logger.info({
      action: "database_export_json_completed",
      totalTables: exportData.summary.totalTables,
      totalRecords: exportData.summary.totalRecords,
      user: session.user.name,
    });

    // 7. 返回 JSON 数据
    return Response.json(exportData, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Content-Disposition": `attachment; filename="database_export_${new Date().toISOString().slice(0, -5)}.json"`,
      },
    });

  } catch (error) {
    logger.error({
      action: "database_export_json_error",
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        error: "导出 JSON 数据失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 获取表的列信息
 */
async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  // 这里简化处理，实际可以从数据库 schema 获取
  // 为了演示，返回预定义的列信息
  const columnMaps: Record<string, ColumnInfo[]> = {
    users: [
      { name: "id", type: "serial", nullable: false },
      { name: "name", type: "varchar", nullable: false },
      { name: "description", type: "text", nullable: true },
      { name: "role", type: "varchar", nullable: false },
      { name: "rpmLimit", type: "integer", nullable: false },
      { name: "dailyLimitUsd", type: "numeric", nullable: false },
      { name: "providerGroup", type: "varchar", nullable: true },
      { name: "createdAt", type: "timestamp", nullable: false },
      { name: "updatedAt", type: "timestamp", nullable: false },
      { name: "deletedAt", type: "timestamp", nullable: true },
    ],
    keys: [
      { name: "id", type: "serial", nullable: false },
      { name: "userId", type: "integer", nullable: false },
      { name: "key", type: "varchar", nullable: false },
      { name: "name", type: "varchar", nullable: false },
      { name: "isEnabled", type: "boolean", nullable: false },
      { name: "expiresAt", type: "timestamp", nullable: true },
      { name: "canLoginWebUi", type: "boolean", nullable: false },
      { name: "limit5hUsd", type: "numeric", nullable: true },
      { name: "limitWeeklyUsd", type: "numeric", nullable: true },
      { name: "limitMonthlyUsd", type: "numeric", nullable: true },
      { name: "limitConcurrentSessions", type: "integer", nullable: false },
      { name: "createdAt", type: "timestamp", nullable: false },
      { name: "updatedAt", type: "timestamp", nullable: false },
      { name: "deletedAt", type: "timestamp", nullable: true },
    ],
    providers: [
      { name: "id", type: "serial", nullable: false },
      { name: "name", type: "varchar", nullable: false },
      { name: "description", type: "text", nullable: true },
      { name: "url", type: "varchar", nullable: false },
      { name: "key", type: "varchar", nullable: false },
      { name: "isEnabled", type: "boolean", nullable: false },
      { name: "weight", type: "integer", nullable: false },
      { name: "priority", type: "integer", nullable: false },
      { name: "costMultiplier", type: "numeric", nullable: false },
      { name: "groupTag", type: "varchar", nullable: true },
      { name: "providerType", type: "varchar", nullable: false },
      { name: "modelRedirects", type: "jsonb", nullable: true },
      { name: "allowedModels", type: "jsonb", nullable: true },
      { name: "limit5hUsd", type: "numeric", nullable: true },
      { name: "limitWeeklyUsd", type: "numeric", nullable: true },
      { name: "limitMonthlyUsd", type: "numeric", nullable: true },
      { name: "limitConcurrentSessions", type: "integer", nullable: false },
      { name: "createdAt", type: "timestamp", nullable: false },
      { name: "updatedAt", type: "timestamp", nullable: false },
      { name: "deletedAt", type: "timestamp", nullable: true },
    ],
    messageRequest: [
      { name: "id", type: "serial", nullable: false },
      { name: "requestId", type: "varchar", nullable: false },
      { name: "requestTimestamp", type: "timestamp", nullable: false },
      { name: "requestModel", type: "varchar", nullable: false },
      { name: "requestTokens", type: "integer", nullable: false },
      { name: "responseTimestamp", type: "timestamp", nullable: true },
      { name: "responseTokens", type: "integer", nullable: true },
      { name: "responseDuration", type: "integer", nullable: true },
      { name: "isSuccessful", type: "boolean", nullable: false },
      { name: "errorMessage", type: "text", nullable: true },
    ],
    // ... 其他表的列信息
  };

  return columnMaps[tableName] || [];
}

/**
 * 导出表数据
 */
async function exportTableData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  tableName: string,
  config: ExportConfig
): Promise<DataRecord[]> {
  try {
    // 直接使用 any 类型来绕过严格的 Drizzle 类型检查
    // 这是必要的，因为我们需要动态处理不同的表
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = db.select().from(table as any);

    // 添加软删除过滤（排除已删除的记录）
    if (hasDeletedAtColumn(tableName)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query.where(isNull(getDeletedAtColumn(table) as any));
    }

    // 限制记录数（用于测试）
    if (config.maxRecords && config.maxRecords > 0) {
      query.limit(config.maxRecords);
    }

    // 执行查询
    let data = await query;

    // 对于敏感表，如果不包含敏感数据，则过滤字段
    if (!config.includeSensitiveData) {
      data = data.map((record: DataRecord) => {
        const filtered = { ...record };
        if (tableName === "keys" && "key" in filtered) {
          delete filtered.key;
        } else if (tableName === "providers" && "key" in filtered) {
          delete filtered.key;
        }
        return filtered;
      });
    }

    // 转换日期字段为 ISO 字符串
    return data.map((record: DataRecord) => {
      const converted = { ...record } as DataRecord;

      // 转换日期字段
      if (converted.createdAt && converted.createdAt instanceof Date) {
        converted.createdAt = converted.createdAt.toISOString();
      }
      if (converted.updatedAt && converted.updatedAt instanceof Date) {
        converted.updatedAt = converted.updatedAt.toISOString();
      }
      if (converted.expiresAt && converted.expiresAt instanceof Date) {
        converted.expiresAt = converted.expiresAt.toISOString();
      }
      if (converted.deletedAt && converted.deletedAt instanceof Date) {
        converted.deletedAt = converted.deletedAt.toISOString();
      }

      return converted;
    });

  } catch (error) {
    logger.error({
      action: "export_table_data_error",
      table: tableName,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * 检查表是否有 deletedAt 列
 */
function hasDeletedAtColumn(tableName: string): boolean {
  return ["users", "keys", "providers"].includes(tableName);
}

/**
 * 获取 deletedAt 列引用
 */
function getDeletedAtColumn(table: unknown): unknown {
  if (table === usersTable) return usersTable.deletedAt;
  if (table === keysTable) return keysTable.deletedAt;
  if (table === providersTable) return providersTable.deletedAt;
  return null;
}