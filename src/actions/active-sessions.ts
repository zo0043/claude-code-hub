"use server";

import { SessionManager } from "@/lib/session-manager";
import type { ActionResult } from "./types";
import type { ActiveSessionInfo } from "@/types/session";

/**
 * 获取所有活跃 session 的详细信息
 * 用于实时监控页面
 */
export async function getActiveSessions(): Promise<ActionResult<ActiveSessionInfo[]>> {
  try {
    const sessions = await SessionManager.getActiveSessions();
    return {
      ok: true,
      data: sessions,
    };
  } catch (error) {
    console.error('Failed to get active sessions:', error);
    return {
      ok: false,
      error: '获取活跃 session 失败',
    };
  }
}

/**
 * 获取指定 session 的 messages 内容
 * 仅当 STORE_SESSION_MESSAGES=true 时可用
 */
export async function getSessionMessages(sessionId: string): Promise<ActionResult<unknown>> {
  try {
    const messages = await SessionManager.getSessionMessages(sessionId);
    if (messages === null) {
      return {
        ok: false,
        error: 'Messages 未存储或已过期',
      };
    }
    return {
      ok: true,
      data: messages,
    };
  } catch (error) {
    console.error('Failed to get session messages:', error);
    return {
      ok: false,
      error: '获取 session messages 失败',
    };
  }
}
