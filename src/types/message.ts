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
  costUsd?: number; // 单次请求费用（美元）
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
  cost_usd?: number; // 单次请求费用（美元）
}

/**
 * SSE 解析后的事件数据
 */
export interface ParsedSSEEvent {
  event: string;
  data: Record<string, unknown> | string;
}
