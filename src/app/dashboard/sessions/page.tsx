"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { getActiveSessions } from "@/actions/active-sessions";
import { ActiveSessionsTable } from "./_components/active-sessions-table";
import type { ActiveSessionInfo } from "@/types/session";

const REFRESH_INTERVAL = 3000; // 3秒刷新一次

async function fetchActiveSessions(): Promise<ActiveSessionInfo[]> {
  const result = await getActiveSessions();
  if (!result.ok) {
    throw new Error(result.error || '获取活跃 session 失败');
  }
  return result.data;
}

/**
 * 活跃 Session 实时监控页面
 */
export default function ActiveSessionsPage() {
  const router = useRouter();

  const { data: sessions = [], isLoading, error } = useQuery<ActiveSessionInfo[], Error>({
    queryKey: ["active-sessions"],
    queryFn: fetchActiveSessions,
    refetchInterval: REFRESH_INTERVAL,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <div>
          <h1 className="text-2xl font-bold">活跃 Session 监控</h1>
          <p className="text-sm text-muted-foreground">
            实时显示最近 5 分钟内的活跃请求（每 3 秒自动刷新）
          </p>
        </div>
      </div>

      <Section title="活跃 Session 列表">
        {error ? (
          <div className="text-center text-destructive py-8">
            加载失败: {error.message}
          </div>
        ) : (
          <ActiveSessionsTable
            sessions={sessions}
            isLoading={isLoading}
          />
        )}
      </Section>
    </div>
  );
}
