import type { Provider } from "@/types/provider";
import { findProviderList, findProviderById } from "@/repository/provider";
import { findLatestMessageRequestByKey } from "@/repository/message";
import { RateLimitService } from "@/lib/rate-limit";
import { isCircuitOpen, getCircuitState } from "@/lib/circuit-breaker";
import { ProxyLogger } from "./logger";
import { ProxyResponses } from "./responses";
import type { ProxySession } from "./session";

export class ProxyProviderResolver {
  static async ensure(session: ProxySession, targetProviderType: 'claude' | 'codex' = 'claude'): Promise<Response | null> {
    // 标记选择方法
    let selectionMethod: 'reuse' | 'random' | 'group_filter' | 'fallback' = 'random';

    // 尝试复用之前的供应商
    const reusedProvider = await ProxyProviderResolver.findReusable(session, targetProviderType);
    if (reusedProvider) {
      session.setProvider(reusedProvider);
      selectionMethod = 'reuse';
    }

    // 如果没有可复用的，随机选择
    if (!session.provider) {
      session.setProvider(await ProxyProviderResolver.pickRandomProvider(session, [], targetProviderType));
    }

    // ✅ 关键修复：选定供应商后立即记录到决策链
    if (session.provider) {
      session.addProviderToChain(session.provider, {
        reason: 'initial_selection',
        selectionMethod,
        circuitState: getCircuitState(session.provider.id),
      });
      return null;
    }

    // 无可用供应商
    const status = 503;
    const message = "暂无可用的上游服务";
    console.error("[ProviderSelector] No available providers");
    await ProxyLogger.logFailure(session, new Error(message));
    return ProxyResponses.buildError(status, message);
  }

  /**
   * ✅ 公开方法：选择供应商（支持排除列表，用于重试场景）
   */
  static async pickRandomProviderWithExclusion(
    session: ProxySession,
    excludeIds: number[]
  ): Promise<Provider | null> {
    return this.pickRandomProvider(session, excludeIds);
  }

  private static async findReusable(session: ProxySession): Promise<Provider | null> {
    if (!session.shouldReuseProvider()) {
      return null;
    }

    const apiKey = session.authState?.apiKey;
    if (!apiKey) {
      return null;
    }

    const latestRequest = await findLatestMessageRequestByKey(apiKey);
    if (!latestRequest?.providerId) {
      return null;
    }

    const provider = await findProviderById(latestRequest.providerId);
    if (!provider || !provider.isEnabled) {
      return null;
    }

    return provider;
  }

  private static async pickRandomProvider(
    session?: ProxySession,
    excludeIds: number[] = []  // ✅ 新增：排除已失败的供应商
  ): Promise<Provider | null> {
    const allProviders = await findProviderList();

    // Step 0: 第一层过滤 - 排除已禁用和黑名单中的供应商
    const enabledProviders = allProviders.filter(
      (provider) => provider.isEnabled && !excludeIds.includes(provider.id)
    );

    if (enabledProviders.length === 0) {
      console.warn('[ProviderSelector] No enabled providers after exclusion filter');
      return null;
    }

    // Step 1: 用户分组过滤（如果用户指定了分组）
    let candidateProviders = enabledProviders;
    const userGroup = session?.authState?.user?.providerGroup;
    if (userGroup) {
      const groupFiltered = enabledProviders.filter(
        (p) => p.groupTag === userGroup
      );

      if (groupFiltered.length > 0) {
        candidateProviders = groupFiltered;
        console.debug(
          `[ProviderSelector] User group '${userGroup}' filter: ${groupFiltered.length} providers`
        );
      } else {
        console.warn(
          `[ProviderSelector] User group '${userGroup}' has no providers, falling back to all`
        );
      }
    }

    // Step 2: 过滤超限供应商（健康度过滤）
    const healthyProviders = await this.filterByLimits(candidateProviders);

    // ✅ 记录过滤掉的供应商（熔断或限流）
    const filteredOut = candidateProviders.filter(
      p => !healthyProviders.find(hp => hp.id === p.id)
    );
    if (filteredOut.length > 0) {
      const reasons = await Promise.all(
        filteredOut.map(async p => {
          if (isCircuitOpen(p.id)) {
            const state = getCircuitState(p.id);
            return `${p.name}(id=${p.id}, circuit=${state})`;
          }
          return `${p.name}(id=${p.id}, rate-limited)`;
        })
      );
      console.debug(`[ProviderSelector] Filtered out: ${reasons.join(', ')}`);
    }

    if (healthyProviders.length === 0) {
      console.warn('[ProviderSelector] All providers rate limited, falling back to random');
      // Fail Open：降级到随机选择（让上游拒绝）
      return this.weightedRandom(candidateProviders);
    }

    // Step 3: 优先级分层（只选择最高优先级的供应商）
    const topPriorityProviders = this.selectTopPriority(healthyProviders);

    // Step 4: 成本排序 + 加权选择
    const selected = this.selectOptimal(topPriorityProviders);

    // ✅ 详细的选择日志
    const minPriority = Math.min(...healthyProviders.map(p => p.priority || 0));
    console.info(`[ProviderSelector] Selection Decision:
  ├─ Total providers: ${allProviders.length}
  ├─ Enabled: ${enabledProviders.length}
  ├─ Excluded IDs: ${excludeIds.length > 0 ? excludeIds.join(', ') : 'none'}
  ├─ User group filter: '${userGroup || 'none'}'
  ├─ After group filter: ${candidateProviders.length} (${candidateProviders.map(p => p.name).join(', ')})
  ├─ After health/circuit filter: ${healthyProviders.length}
  ${filteredOut.length > 0 ? `│  └─ Filtered: ${filteredOut.map(p => p.name).join(', ')}` : ''}
  ├─ Top priority level: ${minPriority}
  ├─ Top priority candidates: ${topPriorityProviders.map(p => `${p.name}(w=${p.weight}, cost=${p.costMultiplier}x)`).join(', ')}
  └─ ✓ Selected: ${selected.name} (id=${selected.id}, priority=${selected.priority}, weight=${selected.weight}, cost=${selected.costMultiplier}x, circuit=${getCircuitState(selected.id)})
    `);

    return selected;
  }

  /**
   * 过滤超限供应商
   */
  private static async filterByLimits(providers: Provider[]): Promise<Provider[]> {
    const results = await Promise.all(
      providers.map(async (p) => {
        // 0. 检查熔断器状态
        if (isCircuitOpen(p.id)) {
          console.debug(`[ProviderSelector] Provider ${p.id} circuit breaker is open`);
          return null;
        }

        // 1. 检查金额限制
        const costCheck = await RateLimitService.checkCostLimits(p.id, 'provider', {
          limit_5h_usd: p.limit5hUsd,
          limit_weekly_usd: p.limitWeeklyUsd,
          limit_monthly_usd: p.limitMonthlyUsd,
        });

        if (!costCheck.allowed) {
          console.debug(`[ProviderSelector] Provider ${p.id} cost limit exceeded`);
          return null;
        }

        // 2. 检查并发 Session 限制
        const sessionCheck = await RateLimitService.checkSessionLimit(
          p.id,
          'provider',
          p.limitConcurrentSessions || 0
        );

        if (!sessionCheck.allowed) {
          console.debug(`[ProviderSelector] Provider ${p.id} session limit exceeded`);
          return null;
        }

        return p;
      })
    );

    return results.filter((p): p is Provider => p !== null);
  }

  /**
   * 优先级分层：只选择最高优先级的供应商
   */
  private static selectTopPriority(providers: Provider[]): Provider[] {
    if (providers.length === 0) {
      return [];
    }

    // 找到最小的优先级值（最高优先级）
    const minPriority = Math.min(...providers.map(p => p.priority || 0));

    // 只返回该优先级的供应商
    return providers.filter(p => (p.priority || 0) === minPriority);
  }

  /**
   * 成本排序 + 加权选择：在同优先级内，按成本排序后加权随机
   */
  private static selectOptimal(providers: Provider[]): Provider {
    if (providers.length === 0) {
      throw new Error('No providers available for selection');
    }

    if (providers.length === 1) {
      return providers[0];
    }

    // 按成本倍率排序（倍率低的在前）
    const sorted = [...providers].sort((a, b) => {
      const costA = a.costMultiplier;
      const costB = b.costMultiplier;
      return costA - costB;
    });

    // 加权随机选择（复用现有逻辑）
    return this.weightedRandom(sorted);
  }

  /**
   * 加权随机选择
   */
  private static weightedRandom(providers: Provider[]): Provider {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);

    if (totalWeight === 0) {
      const randomIndex = Math.floor(Math.random() * providers.length);
      return providers[randomIndex];
    }

    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (const provider of providers) {
      cumulativeWeight += provider.weight;
      if (random < cumulativeWeight) {
        return provider;
      }
    }

    return providers[providers.length - 1];
  }
}
