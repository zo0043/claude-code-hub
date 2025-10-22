"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUsageLogs } from "@/actions/usage-logs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Pause, Play } from "lucide-react";
import { UsageLogsFilters } from "./usage-logs-filters";
import { UsageLogsTable } from "./usage-logs-table";
import type { UsageLogsResult } from "@/repository/usage-logs";
import type { UserDisplay } from "@/types/user";
import type { ProviderDisplay } from "@/types/provider";

interface UsageLogsViewProps {
  isAdmin: boolean;
  users: UserDisplay[];
  providers: ProviderDisplay[];
  searchParams: { [key: string]: string | string[] | undefined };
}

export function UsageLogsView({
  isAdmin,
  users,
  providers,
  searchParams,
}: UsageLogsViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<UsageLogsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // 从 URL 参数解析筛选条件
  const filters: {
    userId?: number;
    keyId?: number;
    providerId?: number;
    startDate?: Date;
    endDate?: Date;
    statusCode?: number;
    model?: string;
    page: number;
  } = {
    userId: searchParams.userId ? parseInt(searchParams.userId as string) : undefined,
    keyId: searchParams.keyId ? parseInt(searchParams.keyId as string) : undefined,
    providerId: searchParams.providerId ? parseInt(searchParams.providerId as string) : undefined,
    startDate: searchParams.startDate ? new Date(searchParams.startDate as string) : undefined,
    endDate: searchParams.endDate ? new Date(searchParams.endDate as string) : undefined,
    statusCode: searchParams.statusCode ? parseInt(searchParams.statusCode as string) : undefined,
    model: searchParams.model as string | undefined,
    page: searchParams.page ? parseInt(searchParams.page as string) : 1,
  };

  // 使用 ref 来存储最新的值,避免闭包陷阱
  const isPendingRef = useRef(isPending);
  const filtersRef = useRef(filters);

  isPendingRef.current = isPending;

  // 更新 filtersRef
  filtersRef.current = filters;

  // 加载数据
  const loadData = async () => {
    startTransition(async () => {
      const result = await getUsageLogs(filtersRef.current);
      if (result.ok && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(!result.ok && 'error' in result ? result.error : "加载失败");
        setData(null);
      }
    });
  };

  // 手动刷新
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await loadData();
    setTimeout(() => setIsManualRefreshing(false), 500);
  };

  // 初始加载
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动轮询
  useEffect(() => {
    if (!isAutoRefresh) return;

    const intervalId = setInterval(() => {
      // 如果正在加载,跳过本次轮询
      if (isPendingRef.current) return;
      loadData();
    }, 10000); // 10 秒间隔

    return () => clearInterval(intervalId);
  }, [isAutoRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // 处理筛选条件变更
  const handleFilterChange = (newFilters: Omit<typeof filters, 'page'>) => {
    const query = new URLSearchParams();

    if (newFilters.userId) query.set("userId", newFilters.userId.toString());
    if (newFilters.keyId) query.set("keyId", newFilters.keyId.toString());
    if (newFilters.providerId) query.set("providerId", newFilters.providerId.toString());
    if (newFilters.startDate) query.set("startDate", newFilters.startDate.toISOString());
    if (newFilters.endDate) query.set("endDate", newFilters.endDate.toISOString());
    if (newFilters.statusCode) query.set("statusCode", newFilters.statusCode.toString());
    if (newFilters.model) query.set("model", newFilters.model);

    router.push(`/dashboard/logs?${query.toString()}`);
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    const query = new URLSearchParams(params.toString());
    query.set("page", page.toString());
    router.push(`/dashboard/logs?${query.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>总请求数</CardDescription>
              <CardTitle className="text-3xl font-mono">
                {data.summary.totalRequests.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>总消耗金额</CardDescription>
              <CardTitle className="text-3xl font-mono">
                ${data.summary.totalCost.toFixed(4)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>总 Token 数</CardDescription>
              <CardTitle className="text-3xl font-mono">
                {data.summary.totalTokens.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>输入:</span>
                <span className="font-mono">{data.summary.totalInputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>输出:</span>
                <span className="font-mono">{data.summary.totalOutputTokens.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>缓存 Token</CardDescription>
              <CardTitle className="text-3xl font-mono">
                {(data.summary.totalCacheCreationTokens + data.summary.totalCacheReadTokens).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>写入:</span>
                <span className="font-mono">{data.summary.totalCacheCreationTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>读取:</span>
                <span className="font-mono">{data.summary.totalCacheReadTokens.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageLogsFilters
            isAdmin={isAdmin}
            users={users}
            providers={providers}
            filters={filters}
            onChange={handleFilterChange}
            onReset={() => router.push("/dashboard/logs")}
          />
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>使用记录</CardTitle>
            <div className="flex items-center gap-2">
              {/* 手动刷新按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isPending}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isManualRefreshing ? 'animate-spin' : ''}`}
                />
                刷新
              </Button>

              {/* 自动刷新开关 */}
              <Button
                variant={isAutoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                className="gap-2"
              >
                {isAutoRefresh ? (
                  <>
                    <Pause className="h-4 w-4" />
                    停止自动刷新
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    开启自动刷新
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : !data ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : (
            <UsageLogsTable
              logs={data.logs}
              total={data.total}
              page={filters.page || 1}
              pageSize={50}
              onPageChange={handlePageChange}
              isPending={isPending}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
