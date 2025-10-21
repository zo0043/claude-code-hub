'use server';

import { findProviderList, createProvider, updateProvider, deleteProvider, getProviderStatistics } from "@/repository/provider";
import { revalidatePath } from "next/cache";
import { type ProviderDisplay } from "@/types/provider";
import { maskKey } from "@/lib/utils/validation";
import { getSession } from "@/lib/auth";
import { CreateProviderSchema, UpdateProviderSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "./types";
import { getAllHealthStatus, resetCircuit } from "@/lib/circuit-breaker";

// 获取服务商数据
export async function getProviders(): Promise<ProviderDisplay[]> {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'admin') {
      return [];
    }

    // 并行获取供应商列表和统计数据
    const [providers, statistics] = await Promise.all([
      findProviderList(),
      getProviderStatistics().catch(() => []), // 统计查询失败时返回空数组
    ]);

    // 将统计数据按 provider_id 索引
    const statsMap = new Map(
      statistics.map(stat => [stat.id, stat])
    );

    return providers.map(provider => {
      const stats = statsMap.get(provider.id);

      return {
        id: provider.id,
        name: provider.name,
        url: provider.url,
        maskedKey: maskKey(provider.key),
        isEnabled: provider.isEnabled,
        weight: provider.weight,
        priority: provider.priority,
        costMultiplier: provider.costMultiplier,
        groupTag: provider.groupTag,
        providerType: provider.providerType,
        modelRedirects: provider.modelRedirects,
        limit5hUsd: provider.limit5hUsd,
        limitWeeklyUsd: provider.limitWeeklyUsd,
        limitMonthlyUsd: provider.limitMonthlyUsd,
        limitConcurrentSessions: provider.limitConcurrentSessions,
        tpm: provider.tpm,
        rpm: provider.rpm,
        rpd: provider.rpd,
        cc: provider.cc,
        createdAt: provider.createdAt.toISOString().split('T')[0],
        updatedAt: provider.updatedAt.toISOString().split('T')[0],
        // 统计数据（可能为空）
        todayTotalCostUsd: stats?.today_cost,
        todayCallCount: stats?.today_calls ?? 0,
        lastCallTime: stats?.last_call_time?.toISOString() ?? null,
        lastCallModel: stats?.last_call_model ?? null,
      };
    });
  } catch (error) {
    console.error("获取服务商数据失败:", error);
    return [];
  }
}

// 添加服务商
export async function addProvider(data: {
  name: string;
  url: string;
  key: string;
  is_enabled?: boolean;
  weight?: number;
  priority?: number;
  cost_multiplier?: number;
  group_tag?: string | null;
  provider_type?: string;
  model_redirects?: Record<string, string> | null;
  limit_5h_usd?: number | null;
  limit_weekly_usd?: number | null;
  limit_monthly_usd?: number | null;
  limit_concurrent_sessions?: number | null;
  tpm: number | null;
  rpm: number | null;
  rpd: number | null;
  cc: number | null;
}): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'admin') {
      return { ok: false, error: '无权限执行此操作' };
    }

    const validated = CreateProviderSchema.parse(data);
    const payload = {
      ...validated,
      limit_5h_usd: validated.limit_5h_usd ?? null,
      limit_weekly_usd: validated.limit_weekly_usd ?? null,
      limit_monthly_usd: validated.limit_monthly_usd ?? null,
      limit_concurrent_sessions: validated.limit_concurrent_sessions ?? 0,
      tpm: validated.tpm ?? null,
      rpm: validated.rpm ?? null,
      rpd: validated.rpd ?? null,
      cc: validated.cc ?? null,
    };
    await createProvider(payload);
    revalidatePath('/settings/providers');
    return { ok: true };
  } catch (error) {
    console.error('创建服务商失败:', error);
    const message = error instanceof Error ? error.message : '创建服务商失败';
    return { ok: false, error: message };
  }
}

// 更新服务商
export async function editProvider(
  providerId: number,
  data: {
    name?: string;
    url?: string;
    key?: string;
    is_enabled?: boolean;
    weight?: number;
    priority?: number;
    cost_multiplier?: number;
    group_tag?: string | null;
    provider_type?: string;
    model_redirects?: Record<string, string> | null;
    limit_5h_usd?: number | null;
    limit_weekly_usd?: number | null;
    limit_monthly_usd?: number | null;
    limit_concurrent_sessions?: number | null;
    tpm?: number | null;
    rpm?: number | null;
    rpd?: number | null;
    cc?: number | null;
  }
): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'admin') {
      return { ok: false, error: '无权限执行此操作' };
    }

    const validated = UpdateProviderSchema.parse(data);
    await updateProvider(providerId, validated);
    revalidatePath('/settings/providers');
    return { ok: true };
  } catch (error) {
    console.error('更新服务商失败:', error);
    const message = error instanceof Error ? error.message : '更新服务商失败';
    return { ok: false, error: message };
  }
}

// 删除服务商
export async function removeProvider(providerId: number): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'admin') {
      return { ok: false, error: '无权限执行此操作' };
    }

    await deleteProvider(providerId);
    revalidatePath('/settings/providers');
    return { ok: true };
  } catch (error) {
    console.error('删除服务商失败:', error);
    const message = error instanceof Error ? error.message : '删除服务商失败';
    return { ok: false, error: message };
  }
}

/**
 * 获取所有供应商的熔断器健康状态
 * 返回格式：{ providerId: { circuitState, failureCount, circuitOpenUntil, ... } }
 */
export async function getProvidersHealthStatus() {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'admin') {
      return {};
    }

    const healthStatus = getAllHealthStatus();

    // 转换为前端友好的格式
    const enrichedStatus: Record<number, {
      circuitState: 'closed' | 'open' | 'half-open';
      failureCount: number;
      lastFailureTime: number | null;
      circuitOpenUntil: number | null;
      recoveryMinutes: number | null;  // 距离恢复的分钟数
    }> = {};

    Object.entries(healthStatus).forEach(([providerId, health]) => {
      enrichedStatus[Number(providerId)] = {
        circuitState: health.circuitState,
        failureCount: health.failureCount,
        lastFailureTime: health.lastFailureTime,
        circuitOpenUntil: health.circuitOpenUntil,
        recoveryMinutes: health.circuitOpenUntil
          ? Math.ceil((health.circuitOpenUntil - Date.now()) / 60000)
          : null,
      };
    });

    return enrichedStatus;
  } catch (error) {
    console.error('获取熔断器状态失败:', error);
    return {};
  }
}

/**
 * 手动重置供应商的熔断器状态
 */
export async function resetProviderCircuit(providerId: number): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'admin') {
      return { ok: false, error: '无权限执行此操作' };
    }

    resetCircuit(providerId);
    revalidatePath('/settings/providers');

    return { ok: true };
  } catch (error) {
    console.error('重置熔断器失败:', error);
    const message = error instanceof Error ? error.message : '重置熔断器失败';
    return { ok: false, error: message };
  }
}
