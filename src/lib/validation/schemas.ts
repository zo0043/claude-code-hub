import { z } from "zod";
import { PROVIDER_LIMITS, PROVIDER_DEFAULTS } from "@/lib/constants/provider.constants";
import { USER_LIMITS, USER_DEFAULTS } from "@/lib/constants/user.constants";

/**
 * 用户创建数据验证schema
 */
export const CreateUserSchema = z.object({
  name: z.string().min(1, "用户名不能为空").max(64, "用户名不能超过64个字符"),
  note: z.string().max(200, "备注不能超过200个字符").optional().default(""),
  providerGroup: z.string().max(50, "供应商分组不能超过50个字符").optional().default(""),
  rpm: z.coerce
    .number()
    .int("RPM必须是整数")
    .min(USER_LIMITS.RPM.MIN, `RPM不能低于${USER_LIMITS.RPM.MIN}`)
    .max(USER_LIMITS.RPM.MAX, `RPM不能超过${USER_LIMITS.RPM.MAX}`)
    .optional()
    .default(USER_DEFAULTS.RPM),
  dailyQuota: z.coerce
    .number()
    .min(USER_LIMITS.DAILY_QUOTA.MIN, `每日额度不能低于${USER_LIMITS.DAILY_QUOTA.MIN}美元`)
    .max(USER_LIMITS.DAILY_QUOTA.MAX, `每日额度不能超过${USER_LIMITS.DAILY_QUOTA.MAX}美元`)
    .optional()
    .default(USER_DEFAULTS.DAILY_QUOTA),
});

/**
 * 用户更新数据验证schema
 */
export const UpdateUserSchema = z.object({
  name: z.string().min(1, "用户名不能为空").max(64, "用户名不能超过64个字符").optional(),
  note: z.string().max(200, "备注不能超过200个字符").optional(),
  providerGroup: z.string().max(50, "供应商分组不能超过50个字符").nullable().optional(),
  rpm: z.coerce
    .number()
    .int("RPM必须是整数")
    .min(USER_LIMITS.RPM.MIN, `RPM不能低于${USER_LIMITS.RPM.MIN}`)
    .max(USER_LIMITS.RPM.MAX, `RPM不能超过${USER_LIMITS.RPM.MAX}`)
    .optional(),
  dailyQuota: z.coerce
    .number()
    .min(USER_LIMITS.DAILY_QUOTA.MIN, `每日额度不能低于${USER_LIMITS.DAILY_QUOTA.MIN}美元`)
    .max(USER_LIMITS.DAILY_QUOTA.MAX, `每日额度不能超过${USER_LIMITS.DAILY_QUOTA.MAX}美元`)
    .optional(),
});

/**
 * 密钥表单数据验证schema
 */
export const KeyFormSchema = z.object({
  name: z
    .string()
    .min(1, "密钥名称不能为空")
    .max(64, "密钥名称不能超过64个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "密钥名称只能包含字母、数字、下划线和连字符"),
  expiresAt: z
    .string()
    .optional()
    .default("")
    .transform((val) => (val === "" ? undefined : val)),
  // Web UI 登录权限控制
  canLoginWebUi: z.boolean().optional().default(true),
  // 金额限流配置
  limit5hUsd: z.coerce
    .number()
    .min(0, "5小时消费上限不能为负数")
    .max(10000, "5小时消费上限不能超过10000美元")
    .nullable()
    .optional(),
  limitWeeklyUsd: z.coerce
    .number()
    .min(0, "周消费上限不能为负数")
    .max(50000, "周消费上限不能超过50000美元")
    .nullable()
    .optional(),
  limitMonthlyUsd: z.coerce
    .number()
    .min(0, "月消费上限不能为负数")
    .max(200000, "月消费上限不能超过200000美元")
    .nullable()
    .optional(),
  limitConcurrentSessions: z.coerce
    .number()
    .int("并发Session上限必须是整数")
    .min(0, "并发Session上限不能为负数")
    .max(1000, "并发Session上限不能超过1000")
    .optional()
    .default(0),
});

/**
 * 服务商创建数据验证schema
 */
export const CreateProviderSchema = z.object({
  name: z.string().min(1, "服务商名称不能为空").max(64, "服务商名称不能超过64个字符"),
  url: z.string().url("请输入有效的URL地址").max(255, "URL长度不能超过255个字符"),
  key: z.string().min(1, "API密钥不能为空").max(1000, "API密钥长度不能超过1000个字符"),
  // 数据库字段命名：下划线
  is_enabled: z.boolean().optional().default(PROVIDER_DEFAULTS.IS_ENABLED),
  weight: z
    .number()
    .int()
    .min(PROVIDER_LIMITS.WEIGHT.MIN)
    .max(PROVIDER_LIMITS.WEIGHT.MAX)
    .optional()
    .default(PROVIDER_DEFAULTS.WEIGHT),
  priority: z.number().int("优先级必须是整数").min(0, "优先级不能为负数").optional().default(0),
  cost_multiplier: z.coerce.number().min(0, "成本倍率不能为负数").optional().default(1.0),
  group_tag: z.string().max(50, "分组标签不能超过50个字符").nullable().optional(),
  // Codex 支持:供应商类型和模型重定向
  provider_type: z.string().max(20, "供应商类型不能超过20个字符").optional().default("claude"),
  model_redirects: z.record(z.string(), z.string()).nullable().optional(),
  // 金额限流配置
  limit_5h_usd: z.coerce
    .number()
    .min(0, "5小时消费上限不能为负数")
    .max(10000, "5小时消费上限不能超过10000美元")
    .nullable()
    .optional(),
  limit_weekly_usd: z.coerce
    .number()
    .min(0, "周消费上限不能为负数")
    .max(50000, "周消费上限不能超过50000美元")
    .nullable()
    .optional(),
  limit_monthly_usd: z.coerce
    .number()
    .min(0, "月消费上限不能为负数")
    .max(200000, "月消费上限不能超过200000美元")
    .nullable()
    .optional(),
  limit_concurrent_sessions: z.coerce
    .number()
    .int("并发Session上限必须是整数")
    .min(0, "并发Session上限不能为负数")
    .max(1000, "并发Session上限不能超过1000")
    .optional()
    .default(0),
  // 废弃字段（保留向后兼容，不再验证范围）
  tpm: z.number().int().nullable().optional(),
  rpm: z.number().int().nullable().optional(),
  rpd: z.number().int().nullable().optional(),
  cc: z.number().int().nullable().optional(),
});

/**
 * 服务商更新数据验证schema
 */
export const UpdateProviderSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    url: z.string().url().max(255).optional(),
    key: z.string().min(1).max(255).optional(),
    is_enabled: z.boolean().optional(),
    weight: z
      .number()
      .int()
      .min(PROVIDER_LIMITS.WEIGHT.MIN)
      .max(PROVIDER_LIMITS.WEIGHT.MAX)
      .optional(),
    priority: z.number().int("优先级必须是整数").min(0, "优先级不能为负数").optional(),
    cost_multiplier: z.coerce.number().min(0, "成本倍率不能为负数").optional(),
    group_tag: z.string().max(50, "分组标签不能超过50个字符").nullable().optional(),
    // Codex 支持:供应商类型和模型重定向
    provider_type: z.string().max(20, "供应商类型不能超过20个字符").optional(),
    model_redirects: z.record(z.string(), z.string()).nullable().optional(),
    // 金额限流配置
    limit_5h_usd: z.coerce
      .number()
      .min(0, "5小时消费上限不能为负数")
      .max(10000, "5小时消费上限不能超过10000美元")
      .nullable()
      .optional(),
    limit_weekly_usd: z.coerce
      .number()
      .min(0, "周消费上限不能为负数")
      .max(50000, "周消费上限不能超过50000美元")
      .nullable()
      .optional(),
    limit_monthly_usd: z.coerce
      .number()
      .min(0, "月消费上限不能为负数")
      .max(200000, "月消费上限不能超过200000美元")
      .nullable()
      .optional(),
    limit_concurrent_sessions: z.coerce
      .number()
      .int("并发Session上限必须是整数")
      .min(0, "并发Session上限不能为负数")
      .max(1000, "并发Session上限不能超过1000")
      .optional(),
    // 废弃字段（保留向后兼容，不再验证范围）
    tpm: z.number().int().nullable().optional(),
    rpm: z.number().int().nullable().optional(),
    rpd: z.number().int().nullable().optional(),
    cc: z.number().int().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "更新内容为空" });

/**
 * 系统设置更新数据验证schema
 */
export const UpdateSystemSettingsSchema = z.object({
  siteTitle: z.string().min(1, "站点标题不能为空").max(128, "站点标题不能超过128个字符"),
  allowGlobalUsageView: z.boolean(),
});

// 导出类型推断
