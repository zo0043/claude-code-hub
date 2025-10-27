import type { Numeric } from "decimal.js-light";
// import { logger } from "@/lib/logger"; // 暂时未使用，注释掉

/**
 * 供应商信息（用于决策链）
 * 记录详细的选择决策过程和上下文
 */
export interface ProviderChainItem {
  id: number;
  name: string;

  // === 选择原因（细化） ===
  reason?:
    | "session_reuse" // 会话复用
    | "initial_selection" // 首次选择（成功）
    | "concurrent_limit_failed" // 并发限制失败
    | "retry_success" // 重试成功
    | "retry_failed"; // 重试失败

  // === 选择方法（细化） ===
  selectionMethod?:
    | "session_reuse" // 会话复用
    | "weighted_random" // 加权随机
    | "group_filtered" // 分组筛选后随机
    | "fail_open_fallback"; // Fail Open 降级

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

  // === 决策上下文（完整记录） ===
  decisionContext?: {
    // --- 供应商池状态 ---
    totalProviders: number; // 系统总供应商数
    enabledProviders: number; // 启用的供应商数
    targetType: "claude" | "codex"; // 目标类型

    // --- 用户分组筛选 ---
    userGroup?: string; // 用户分组（如果有）
    afterGroupFilter?: number; // 分组筛选后数量
    groupFilterApplied: boolean; // 是否应用了分组筛选

    // --- 健康检查过滤 ---
    beforeHealthCheck: number; // 健康检查前数量
    afterHealthCheck: number; // 健康检查后数量
    filteredProviders?: Array<{
      // 被过滤的供应商
      id: number;
      name: string;
      reason: "circuit_open" | "rate_limited" | "excluded" | "type_mismatch";
      details?: string; // 额外信息（如费用：$15.2/$15）
    }>;

    // --- 优先级分层 ---
    priorityLevels: number[]; // 所有优先级值（降序）
    selectedPriority: number; // 选定的最高优先级
    candidatesAtPriority: Array<{
      // 该优先级的候选列表
      id: number;
      name: string;
      weight: number;
      costMultiplier: number;
      probability?: number; // 被选中的概率（加权后）
    }>;

    // --- 会话复用特有 ---
    sessionId?: string; // 复用的 session ID
    sessionAge?: number; // 会话年龄（秒）

    // --- 并发限制特有 ---
    concurrentLimit?: number; // 并发限制
    currentConcurrent?: number; // 当前并发数

    // --- 重试特有 ---
    excludedProviderIds?: number[]; // 已排除的供应商 ID 列表
    retryReason?: string; // 重试原因
  };
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

  // 供应商倍率（记录该请求使用的 cost_multiplier）
  costMultiplier?: number;

  // Session ID（用于会话粘性和日志追踪）
  sessionId?: string;

  // 上游决策链（记录尝试的供应商列表）
  providerChain?: ProviderChainItem[];

  // HTTP 状态码
  statusCode?: number;

  // 模型重定向：原始模型名称（用户请求的模型）
  originalModel?: string;

  // Token 使用信息
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;

  // 错误信息
  errorMessage?: string;

  // User-Agent（用于客户端类型分析）
  userAgent?: string;

  // Messages 数量（用于短请求检测和分析）
  messagesCount?: number;

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

  // 供应商倍率（记录该请求使用的 cost_multiplier）
  cost_multiplier?: number;

  // Session ID（用于会话粘性和日志追踪）
  session_id?: string;

  // 上游决策链
  provider_chain?: ProviderChainItem[];

  // HTTP 状态码
  status_code?: number;

  // 模型重定向：原始模型名称（用户请求的模型）
  original_model?: string;

  // Token 使用信息
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;

  // 错误信息
  error_message?: string;

  // User-Agent（用于客户端类型分析）
  user_agent?: string;

  // Messages 数量（用于短请求检测和分析）
  messages_count?: number;
}

/**
 * SSE 解析后的事件数据
 */
export interface ParsedSSEEvent {
  event: string;
  data: Record<string, unknown> | string;
}
