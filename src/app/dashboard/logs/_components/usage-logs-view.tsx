"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUsageLogs } from "@/actions/usage-logs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  // 加载数据
  const loadData = async () => {
    startTransition(async () => {
      const result = await getUsageLogs(filters);
      if (result.ok && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(!result.ok && 'error' in result ? result.error : "加载失败");
        setData(null);
      }
    });
  };

  // 初始加载
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="grid gap-4 md:grid-cols-3">
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
          <CardTitle>使用记录</CardTitle>
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
