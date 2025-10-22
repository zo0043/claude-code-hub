"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSessions } from "@/actions/active-sessions";
import { ActiveSessionsTable } from "./_components/active-sessions-table";
import type { ActiveSessionInfo } from "@/types/session";

const REFRESH_INTERVAL = 3000; // 3秒刷新一次

async function fetchAllSessions(): Promise<{
  active: ActiveSessionInfo[];
  inactive: ActiveSessionInfo[];
}> {
  const result = await getAllSessions();
  if (!result.ok) {
    throw new Error(result.error || '获取 session 列表失败');
  }
  return result.data;
}

/**
 * 活跃 Session 实时监控页面
 */
export default function ActiveSessionsPage() {
  const router = useRouter();

  const {
    data,
    isLoading,
    error,
  } = useQuery<
    { active: ActiveSessionInfo[]; inactive: ActiveSessionInfo[] },
    Error
  >({
    queryKey: ["all-sessions"],
    queryFn: fetchAllSessions,
    refetchInterval: REFRESH_INTERVAL,
  });

  const activeSessions = data?.active || [];
  const inactiveSessions = data?.inactive || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Session 监控</h1>
          <p className="text-sm text-muted-foreground">
            实时显示活跃和非活跃 Session（每 3 秒自动刷新）
          </p>
        </div>
      </div>

      {error ? (
        <div className="text-center text-destructive py-8">
          加载失败: {error.message}
        </div>
      ) : (
        <>
          {/* 活跃 Session 区域 */}
          <Section title="活跃 Session（最近 5 分钟）">
            <ActiveSessionsTable
              sessions={activeSessions}
              isLoading={isLoading}
            />
          </Section>

          {/* 非活跃 Session 区域 */}
          {inactiveSessions.length > 0 && (
            <Section title="非活跃 Session（超过 5 分钟，仅供查看）">
              <ActiveSessionsTable
                sessions={inactiveSessions}
                isLoading={isLoading}
                inactive
              />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
