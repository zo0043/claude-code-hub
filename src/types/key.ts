/**
 * 密钥数据库实体类型
 */
export interface Key {
  id: number;
  userId: number;
  name: string;
  key: string;
  isEnabled: boolean;
  expiresAt?: Date;

  // 金额限流配置
  limit5hUsd: number | null;
  limitWeeklyUsd: number | null;
  limitMonthlyUsd: number | null;
  limitConcurrentSessions: number;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * 密钥创建数据
 */
export interface CreateKeyData {
  user_id: number;
  name: string;
  key: string;
  is_enabled?: boolean;
  expires_at?: Date;
  // 金额限流配置
  limit_5h_usd?: number | null;
  limit_weekly_usd?: number | null;
  limit_monthly_usd?: number | null;
  limit_concurrent_sessions?: number;
}

/**
 * 密钥更新数据
 */
export interface UpdateKeyData {
  name?: string;
  is_enabled?: boolean;
  expires_at?: Date;
  // 金额限流配置
  limit_5h_usd?: number | null;
  limit_weekly_usd?: number | null;
  limit_monthly_usd?: number | null;
  limit_concurrent_sessions?: number;
}
