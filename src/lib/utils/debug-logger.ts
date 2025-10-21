import { isDevelopment, getEnvConfig } from '@/lib/config/env.schema';

/**
 * Debug 日志工具
 * 仅在 DEBUG_MODE=true 或开发环境时输出日志
 */
export function debugLog(context: string, data?: unknown): void {
  try {
    const env = getEnvConfig();
    const shouldLog = isDevelopment() || env.DEBUG_MODE;

    if (shouldLog) {
      const timestamp = new Date().toISOString();
      const prefix = `[DEBUG ${timestamp}] ${context}`;

      if (data === undefined) {
        console.log(prefix);
      } else {
        // 处理 Error 对象
        if (data instanceof Error) {
          console.log(prefix, {
            message: data.message,
            stack: data.stack,
            name: data.name,
          });
        } else {
          // 尝试序列化对象，避免循环引用
          try {
            const serialized = JSON.stringify(data, null, 2);
            console.log(`${prefix}:`, serialized);
          } catch {
            // 如果序列化失败，直接输出
            console.log(prefix, data);
          }
        }
      }
    }
  } catch (error) {
    // Debug 日志本身不应该阻塞程序
    console.error('[DEBUG] debugLog 自身发生错误:', error);
  }
}
