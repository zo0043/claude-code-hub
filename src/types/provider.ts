export interface Provider {
  id: number;
  name: string;
  url: string;
  key: string;
  // 是否启用
  isEnabled: boolean;
  // 权重（0-100）
  weight: number;

  // 新增：优先级和分组配置
  priority: number;
  costMultiplier: number;
  groupTag: string | null;

  // Codex 支持：供应商类型和模型重定向
  providerType: string;
  modelRedirects: Record<string, string> | null;

  // 新增：金额限流配置
  limit5hUsd: number | null;
  limitWeeklyUsd: number | null;
  limitMonthlyUsd: number | null;
  limitConcurrentSessions: number;

  // 废弃（保留向后兼容，但不再使用）
  // TPM (Tokens Per Minute): 每分钟可处理的文本总量
  tpm: number | null;
  // RPM (Requests Per Minute): 每分钟可发起的API调用次数
  rpm: number | null;
  // RPD (Requests Per Day): 每天可发起的API调用总次数
  rpd: number | null;
  // CC (Concurrent Connections/Requests): 同一时刻能同时处理的请求数量
  cc: number | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// 前端显示用的供应商类型（包含格式化后的数据）
export interface ProviderDisplay {
  id: number;
  name: string;
  url: string;
  maskedKey: string;
  isEnabled: boolean;
  weight: number;
  // 新增：优先级和分组配置
  priority: number;
  costMultiplier: number;
  groupTag: string | null;
  // Codex 支持：供应商类型和模型重定向
  providerType: string;
  modelRedirects: Record<string, string> | null;
  // 新增：金额限流配置
  limit5hUsd: number | null;
  limitWeeklyUsd: number | null;
  limitMonthlyUsd: number | null;
  limitConcurrentSessions: number;
  // 废弃字段（保留向后兼容）
  tpm: number | null;
  rpm: number | null;
  rpd: number | null;
  cc: number | null;
  createdAt: string; // 格式化后的日期字符串
  updatedAt: string; // 格式化后的日期字符串
}

export interface CreateProviderData {
  name: string;
  url: string;
  key: string;
  // 是否启用（默认 true）- 数据库字段名
  is_enabled?: boolean;
  // 权重（默认 1）
  weight?: number;

  // 新增：优先级和分组配置
  priority?: number;
  cost_multiplier?: number;
  group_tag?: string | null;

  // Codex 支持：供应商类型和模型重定向
  provider_type?: string;
  model_redirects?: Record<string, string> | null;

  // 新增：金额限流配置
  limit_5h_usd?: number | null;
  limit_weekly_usd?: number | null;
  limit_monthly_usd?: number | null;
  limit_concurrent_sessions?: number;

  // 废弃字段（保留向后兼容）
  // TPM (Tokens Per Minute): 每分钟可处理的文本总量
  tpm: number | null;
  // RPM (Requests Per Minute): 每分钟可发起的API调用次数
  rpm: number | null;
  // RPD (Requests Per Day): 每天可发起的API调用总次数
  rpd: number | null;
  // CC (Concurrent Connections/Requests): 同一时刻能同时处理的请求数量
  cc: number | null;
}

export interface UpdateProviderData {
  name?: string;
  url?: string;
  key?: string;
  // 是否启用 - 数据库字段名
  is_enabled?: boolean;
  // 权重（0-100）
  weight?: number;

  // 新增：优先级和分组配置
  priority?: number;
  cost_multiplier?: number;
  group_tag?: string | null;

  // Codex 支持：供应商类型和模型重定向
  provider_type?: string;
  model_redirects?: Record<string, string> | null;

  // 新增：金额限流配置
  limit_5h_usd?: number | null;
  limit_weekly_usd?: number | null;
  limit_monthly_usd?: number | null;
  limit_concurrent_sessions?: number;

  // 废弃字段（保留向后兼容）
  // TPM (Tokens Per Minute): 每分钟可处理的文本总量
  tpm?: number | null;
  // RPM (Requests Per Minute): 每分钟可发起的API调用次数
  rpm?: number | null;
  // RPD (Requests Per Day): 每天可发起的API调用总次数
  rpd?: number | null;
  // CC (Concurrent Connections/Requests): 同一时刻能同时处理的请求数量
  cc?: number | null;
}
