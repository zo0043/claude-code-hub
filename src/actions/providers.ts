'use server';

import { findProviderList, createProvider, updateProvider, deleteProvider } from "@/repository/provider";
import { revalidatePath } from "next/cache";
import { type ProviderDisplay } from "@/types/provider";
import { maskKey } from "@/lib/utils/validation";
import { getSession } from "@/lib/auth";
import { CreateProviderSchema, UpdateProviderSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "./types";

// 获取服务商数据
export async function getProviders(): Promise<ProviderDisplay[]> {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'admin') {
      return [];
    }

    const providers = await findProviderList();
    
    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      url: provider.url,
      maskedKey: maskKey(provider.key),
      isEnabled: provider.isEnabled,
      weight: provider.weight,
      priority: provider.priority,
      costPerMtok: provider.costPerMtok,
      groupTag: provider.groupTag,
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
    }));
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
  cost_per_mtok?: number | null;
  group_tag?: string | null;
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
    cost_per_mtok?: number | null;
    group_tag?: string | null;
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
