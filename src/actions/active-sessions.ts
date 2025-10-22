"use server";

import { SessionManager } from "@/lib/session-manager";
import { logger } from '@/lib/logger';
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
    logger.error('Failed to get active sessions:', error);
    return {
      ok: false,
      error: "获取活跃 session 失败",
    };
  }
}

/**
 * 获取所有 session（包括活跃和非活跃的）
 * 用于实时监控页面的完整视图
 */
export async function getAllSessions(): Promise<
  ActionResult<{
    active: ActiveSessionInfo[];
    inactive: ActiveSessionInfo[];
  }>
> {
  try {
    const sessions = await SessionManager.getAllSessionsWithExpiry();
    return {
      ok: true,
      data: sessions,
    };
  } catch (error) {
    logger.error('Failed to get all sessions:', error);
    return {
      ok: false,
      error: "获取 session 列表失败",
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
        error: "Messages 未存储或已过期",
      };
    }
    return {
      ok: true,
      data: messages,
    };
  } catch (error) {
    logger.error('Failed to get session messages:', error);
    return {
      ok: false,
      error: "获取 session messages 失败",
    };
  }
}

/**
 * 检查指定 session 是否有 messages 数据
 * 用于判断是否显示"查看详情"按钮
 */
export async function hasSessionMessages(sessionId: string): Promise<ActionResult<boolean>> {
  try {
    const messages = await SessionManager.getSessionMessages(sessionId);
    return {
      ok: true,
      data: messages !== null,
    };
  } catch (error) {
    logger.error('Failed to check session messages:', error);
    return {
      ok: true,
      data: false, // 出错时默认返回 false,避免显示无效按钮
    };
  }
}
