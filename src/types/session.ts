/**
 * 活跃 Session 详细信息
 * 用于实时监控当前正在运行的请求
 */
export interface ActiveSessionInfo {
  // 基础标识
  sessionId: string;

  // 用户和密钥信息
  userName: string;
  userId: number;
  keyId: number;
  keyName: string;

  // 供应商信息
  providerId: number | null;
  providerName: string | null;

  // 请求元数据
  model: string | null;
  apiType: "chat" | "codex";
  startTime: number; // Unix timestamp (ms)

  // 使用量（可能为空，表示请求未完成）
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  totalTokens?: number;
  costUsd?: string;

  // 状态
  status: "in_progress" | "completed" | "error";
  statusCode?: number;
  errorMessage?: string;

  // 派生字段（前端计算）
  durationMs?: number; // 持续时长
}

/**
 * Session 基础信息（存储到 Redis）
 */
export interface SessionStoreInfo {
  userName: string;
  userId: number;
  keyId: number;
  keyName: string;
  model: string | null;
  apiType: "chat" | "codex";
}

/**
 * Session 使用量信息（响应时更新）
 */
export interface SessionUsageUpdate {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  costUsd?: string;
  status: "completed" | "error";
  statusCode?: number;
  errorMessage?: string;
}

/**
 * Session 供应商信息（选择后更新）
 */
export interface SessionProviderInfo {
  providerId: number;
  providerName: string;
}
