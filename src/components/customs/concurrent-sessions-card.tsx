"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { getConcurrentSessions } from "@/actions/concurrent-sessions";

const REFRESH_INTERVAL = 5000; // 5秒刷新一次

async function fetchConcurrentSessions(): Promise<number> {
  const result = await getConcurrentSessions();
  if (!result.ok) {
    throw new Error(result.error || "获取并发数失败");
  }
  return result.data;
}

/**
 * 并发 Session 数显示卡片
 * 显示最近 5 分钟内的活跃 session 数量
 * 点击可跳转到详情页面
 */
export function ConcurrentSessionsCard() {
  const router = useRouter();
  const { data = 0 } = useQuery<number, Error>({
    queryKey: ["concurrent-sessions"],
    queryFn: fetchConcurrentSessions,
    refetchInterval: REFRESH_INTERVAL,
  });

  const handleClick = () => {
    router.push("/dashboard/sessions");
  };

  return (
    <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">当前并发</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{data}</div>
        <p className="text-xs text-muted-foreground">最近 5 分钟活跃 Session（点击查看详情）</p>
      </CardContent>
    </Card>
  );
}
