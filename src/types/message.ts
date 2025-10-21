import type { Numeric } from "decimal.js-light";

/**
 * 供应商信息（用于决策链）
 */
export interface ProviderChainItem {
  id: number;
  name: string;
}

/**
 * 消息请求数据库实体类型
 */
export interface MessageRequest {
  id: number;
  providerId: number;
  userId: number;
  key: string;
  model?: string;
  durationMs?: number;
  costUsd?: string; // 单次请求费用（美元），保持高精度字符串表示

  // 上游决策链（记录尝试的供应商列表）
  providerChain?: ProviderChainItem[];

  // HTTP 状态码
  statusCode?: number;

  // Token 使用信息
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;

  // 错误信息
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * 创建消息请求数据
 */
export interface CreateMessageRequestData {
  provider_id: number;
  user_id: number;
  key: string;
  model?: string;
  duration_ms?: number;
  cost_usd?: Numeric; // 单次请求费用（美元），支持高精度

  // 上游决策链
  provider_chain?: ProviderChainItem[];

  // HTTP 状态码
  status_code?: number;

  // Token 使用信息
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;

  // 错误信息
  error_message?: string;
}

/**
 * SSE 解析后的事件数据
 */
export interface ParsedSSEEvent {
  event: string;
  data: Record<string, unknown> | string;
}
