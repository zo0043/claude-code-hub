"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, DollarSign, Clock } from "lucide-react";
import { getOverviewData } from "@/actions/overview";
import { MetricCard } from "./metric-card";
import { SessionCard } from "./session-card";
import { formatCurrency } from "@/lib/utils/currency";
import type { OverviewData } from "@/actions/overview";

const REFRESH_INTERVAL = 5000; // 5秒刷新一次
const AUTO_SCROLL_SPEED = 30; // 滚动速度（像素/秒）

async function fetchOverviewData(): Promise<OverviewData> {
  const result = await getOverviewData();
  if (!result.ok) {
    throw new Error(result.error || "获取概览数据失败");
  }
  return result.data;
}

/**
 * 概览面板
 * 左侧：4个指标卡片
 * 右侧：横向滚动的Session列表
 */
export function OverviewPanel() {
  const router = useRouter();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, scrollLeft: 0 });

  const { data, isLoading } = useQuery<OverviewData, Error>({
    queryKey: ["overview-data"],
    queryFn: fetchOverviewData,
    refetchInterval: REFRESH_INTERVAL,
  });

  // 自动滚动逻辑
  React.useEffect(() => {
    if (!scrollContainerRef.current || isHovering || isDragging) return;

    const container = scrollContainerRef.current;
    let animationFrameId: number;
    let lastTime = Date.now();

    const autoScroll = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000; // 转换为秒
      lastTime = now;

      const scrollAmount = AUTO_SCROLL_SPEED * deltaTime;
      container.scrollLeft += scrollAmount;

      // 如果滚动到底部，重置到开始
      if (container.scrollLeft >= container.scrollWidth - container.clientWidth) {
        container.scrollLeft = 0;
      }

      animationFrameId = requestAnimationFrame(autoScroll);
    };

    animationFrameId = requestAnimationFrame(autoScroll);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isHovering, isDragging]);

  // 拖拽滚动逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.pageX - scrollContainerRef.current.offsetLeft,
      scrollLeft: scrollContainerRef.current.scrollLeft,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - dragStart.x) * 2; // 拖拽速度倍数
    scrollContainerRef.current.scrollLeft = dragStart.scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 格式化响应时间
  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const metrics = data || {
    concurrentSessions: 0,
    todayRequests: 0,
    todayCost: 0,
    avgResponseTime: 0,
    recentSessions: [],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
      {/* 左侧：指标卡片区域 */}
      <div className="lg:col-span-3">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            title="当前并发"
            value={metrics.concurrentSessions}
            description="最近 5 分钟"
            icon={Activity}
          />
          <MetricCard
            title="今日请求"
            value={metrics.todayRequests}
            description="API 调用次数"
            icon={TrendingUp}
          />
          <MetricCard
            title="今日消耗"
            value={formatCurrency(metrics.todayCost)}
            description="总费用"
            icon={DollarSign}
          />
          <MetricCard
            title="平均响应"
            value={metrics.avgResponseTime}
            description="响应时间"
            icon={Clock}
            formatter={formatResponseTime}
          />
        </div>
        <div className="mt-3">
          <button
            onClick={() => router.push("/dashboard/sessions")}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1.5 hover:bg-muted rounded-md"
          >
            点击查看详情 →
          </button>
        </div>
      </div>

      {/* 右侧：Session滚动区域 */}
      <div className="lg:col-span-9">
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => {
            setIsHovering(false);
            setIsDragging(false);
          }}
          className="flex gap-3 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {isLoading && metrics.recentSessions.length === 0 ? (
            <div className="flex items-center justify-center w-full h-[200px] text-muted-foreground">
              加载中...
            </div>
          ) : metrics.recentSessions.length === 0 ? (
            <div className="flex items-center justify-center w-full h-[200px] text-muted-foreground">
              暂无活跃 Session
            </div>
          ) : (
            // 复制一遍session列表，实现无缝循环滚动
            <>
              {metrics.recentSessions.map((session, index) => (
                <SessionCard
                  key={`${session.sessionId}-${index}`}
                  session={session}
                  className="animate-in fade-in slide-in-from-right-5 duration-300"
                />
              ))}
              {/* 复制一遍用于无缝循环 */}
              {metrics.recentSessions.length > 0 &&
                metrics.recentSessions.map((session, index) => (
                  <SessionCard key={`${session.sessionId}-copy-${index}`} session={session} />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
