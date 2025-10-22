import type { Numeric } from "decimal.js-light";
import { logger } from '@/lib/logger';

/**
 * 供应商信息（用于决策链）
 * 记录详细的选择决策过程和上下文
 */
export interface ProviderChainItem {
  id: number;
  name: string;

  // 选择原因和方法
  reason?: "initial_selection" | "retry_attempt" | "retry_fallback" | "reuse";
  selectionMethod?: "reuse" | "random" | "group_filter" | "fallback";

  // 供应商配置（决策依据）
  priority?: number;
  weight?: number;
  costMultiplier?: number;
  groupTag?: string | null;

  // 健康状态快照
  circuitState?: "closed" | "open" | "half-open";

  // 时间戳和尝试信息
  timestamp?: number;
  attemptNumber?: number; // 第几次尝试（用于标识重试）

  // 错误信息（记录失败时的上游报错）
  errorMessage?: string;
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

  // Session ID（用于会话粘性和日志追踪）
  sessionId?: string;

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

  // Session ID（用于会话粘性和日志追踪）
  session_id?: string;

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
