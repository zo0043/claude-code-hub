/**
 * 简单的熔断器服务（内存实现）
 *
 * 状态机：
 * - Closed（关闭）：正常状态，请求通过
 * - Open（打开）：失败次数超过阈值，请求被拒绝
 * - Half-Open（半开）：等待一段时间后，允许少量请求尝试
 */

import { logger } from "@/lib/logger";

interface ProviderHealth {
  failureCount: number;
  lastFailureTime: number | null;
  circuitState: "closed" | "open" | "half-open";
  circuitOpenUntil: number | null;
  halfOpenSuccessCount: number;
}

// 配置参数
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5, // 失败 5 次后打开熔断器
  openDuration: 30 * 60 * 1000, // 熔断器打开 30 分钟（从 60 秒改为 30 分钟）
  halfOpenSuccessThreshold: 2, // 半开状态下成功 2 次后关闭
};

// 内存存储
const healthMap = new Map<number, ProviderHealth>();

function getOrCreateHealth(providerId: number): ProviderHealth {
  let health = healthMap.get(providerId);
  if (!health) {
    health = {
      failureCount: 0,
      lastFailureTime: null,
      circuitState: "closed",
      circuitOpenUntil: null,
      halfOpenSuccessCount: 0,
    };
    healthMap.set(providerId, health);
  }
  return health;
}

/**
 * 检查熔断器是否打开（不允许请求）
 */
export function isCircuitOpen(providerId: number): boolean {
  const health = getOrCreateHealth(providerId);

  if (health.circuitState === "closed") {
    return false;
  }

  if (health.circuitState === "open") {
    // 检查是否可以转为半开状态
    if (health.circuitOpenUntil && Date.now() > health.circuitOpenUntil) {
      health.circuitState = "half-open";
      health.halfOpenSuccessCount = 0;
      logger.info(`[CircuitBreaker] Provider ${providerId} transitioned to half-open`);
      return false; // 允许尝试
    }
    return true; // 仍在打开状态
  }

  // half-open 状态：允许尝试
  return false;
}

/**
 * 记录请求失败
 */
export function recordFailure(providerId: number, error: Error): void {
  const health = getOrCreateHealth(providerId);

  health.failureCount++;
  health.lastFailureTime = Date.now();

  logger.warn(
    `[CircuitBreaker] Provider ${providerId} failure recorded (${health.failureCount}/${CIRCUIT_BREAKER_CONFIG.failureThreshold}): ${error.message}`,
    {
      providerId,
      failureCount: health.failureCount,
      threshold: CIRCUIT_BREAKER_CONFIG.failureThreshold,
      errorMessage: error.message,
    }
  );

  // 检查是否需要打开熔断器
  if (health.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    health.circuitState = "open";
    health.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_CONFIG.openDuration;
    health.halfOpenSuccessCount = 0;

    logger.error(
      `[CircuitBreaker] Provider ${providerId} circuit opened after ${health.failureCount} failures, will retry at ${new Date(health.circuitOpenUntil).toISOString()}`,
      {
        providerId,
        failureCount: health.failureCount,
        retryAt: new Date(health.circuitOpenUntil).toISOString(),
      }
    );
  }
}

/**
 * 记录请求成功
 */
export function recordSuccess(providerId: number): void {
  const health = getOrCreateHealth(providerId);

  if (health.circuitState === "half-open") {
    // 半开状态下成功
    health.halfOpenSuccessCount++;

    if (health.halfOpenSuccessCount >= CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold) {
      // 关闭熔断器
      health.circuitState = "closed";
      health.failureCount = 0;
      health.lastFailureTime = null;
      health.circuitOpenUntil = null;
      health.halfOpenSuccessCount = 0;

      logger.info(
        `[CircuitBreaker] Provider ${providerId} circuit closed after ${CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold} successes`,
        {
          providerId,
          successThreshold: CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold,
        }
      );
    } else {
      logger.debug(
        `[CircuitBreaker] Provider ${providerId} half-open success (${health.halfOpenSuccessCount}/${CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold})`,
        {
          providerId,
          successCount: health.halfOpenSuccessCount,
          threshold: CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold,
        }
      );
    }
  } else if (health.circuitState === "closed") {
    // 正常状态下成功，重置失败计数
    if (health.failureCount > 0) {
      logger.debug(
        `[CircuitBreaker] Provider ${providerId} success, resetting failure count from ${health.failureCount} to 0`,
        {
          providerId,
          previousFailureCount: health.failureCount,
        }
      );
      health.failureCount = 0;
      health.lastFailureTime = null;
    }
  }
}

/**
 * 获取供应商的熔断器状态（用于决策链记录）
 */
export function getCircuitState(providerId: number): "closed" | "open" | "half-open" {
  const health = getOrCreateHealth(providerId);
  return health.circuitState;
}

/**
 * 获取所有供应商的健康状态（用于监控）
 */
export function getAllHealthStatus(): Record<number, ProviderHealth> {
  const status: Record<number, ProviderHealth> = {};
  healthMap.forEach((health, providerId) => {
    status[providerId] = { ...health };
  });
  return status;
}

/**
 * 手动重置熔断器（用于运维手动恢复）
 */
export function resetCircuit(providerId: number): void {
  const health = getOrCreateHealth(providerId);

  const oldState = health.circuitState;

  // 重置所有状态
  health.circuitState = "closed";
  health.failureCount = 0;
  health.lastFailureTime = null;
  health.circuitOpenUntil = null;
  health.halfOpenSuccessCount = 0;

  logger.info(
    `[CircuitBreaker] Provider ${providerId} circuit manually reset from ${oldState} to closed`,
    {
      providerId,
      previousState: oldState,
      newState: "closed",
    }
  );
}
