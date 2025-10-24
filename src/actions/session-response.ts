"use server";

import { SessionManager } from "@/lib/session-manager";

/**
 * 获取 session 响应体内容
 *
 * @param sessionId - Session ID
 * @returns 响应体内容或错误信息
 */
export async function getSessionResponse(
  sessionId: string
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  try {
    const response = await SessionManager.getSessionResponse(sessionId);

    if (!response) {
      return {
        ok: false,
        error: "响应体已过期（5分钟 TTL）或尚未记录",
      };
    }

    return { ok: true, data: response };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "获取响应体失败",
    };
  }
}
