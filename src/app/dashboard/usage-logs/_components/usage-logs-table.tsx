"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MessageRequest } from "@/types/message";
import { ProviderChainDisplay } from "./provider-chain-display";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface UsageLogsResponse {
  logs: MessageRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchUsageLogs(params: {
  page: number;
  pageSize: number;
  startDate?: string;
  endDate?: string;
  model?: string;
  userId?: number;
}): Promise<UsageLogsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  searchParams.set("pageSize", params.pageSize.toString());

  if (params.startDate) {
    searchParams.set("startDate", params.startDate);
  }
  if (params.endDate) {
    searchParams.set("endDate", params.endDate);
  }
  if (params.model) {
    searchParams.set("model", params.model);
  }
  if (params.userId !== undefined) {
    searchParams.set("userId", params.userId.toString());
  }

  const response = await fetch(`/api/usage-logs?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("获取使用日志失败");
  }

  return response.json();
}

export function UsageLogsTable() {
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(50);
  const [modelFilter, setModelFilter] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["usage-logs", page, pageSize, modelFilter],
    queryFn: () =>
      fetchUsageLogs({
        page,
        pageSize,
        model: modelFilter || undefined,
      }),
  });

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        {error instanceof Error ? error.message : "加载失败"}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!data || data.logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无使用记录
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 筛选器 */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="按模型筛选..."
            value={modelFilter}
            onChange={(e) => {
              setModelFilter(e.target.value);
              setPage(1); // 重置到第一页
            }}
            className="max-w-xs"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          共 {data.total} 条记录
        </div>
      </div>

      {/* 表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">时间</TableHead>
              <TableHead className="w-[120px]">模型</TableHead>
              <TableHead className="text-right w-[100px]">输入 Token</TableHead>
              <TableHead className="text-right w-[100px]">输出 Token</TableHead>
              <TableHead className="text-right w-[100px]">费用 (USD)</TableHead>
              <TableHead className="text-right w-[80px]">耗时 (ms)</TableHead>
              <TableHead className="w-[80px]">状态码</TableHead>
              <TableHead className="min-w-[200px]">上游决策链</TableHead>
              <TableHead className="max-w-[200px]">错误信息</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs font-mono">
                  {formatDistanceToNow(new Date(log.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {log.model || "-"}
                </TableCell>
                <TableCell className="text-right text-xs font-mono">
                  {log.inputTokens?.toLocaleString() || "-"}
                </TableCell>
                <TableCell className="text-right text-xs font-mono">
                  {log.outputTokens?.toLocaleString() || "-"}
                </TableCell>
                <TableCell className="text-right text-xs font-mono">
                  {log.costUsd
                    ? parseFloat(log.costUsd).toFixed(6)
                    : "-"}
                </TableCell>
                <TableCell className="text-right text-xs font-mono">
                  {log.durationMs?.toLocaleString() || "-"}
                </TableCell>
                <TableCell>
                  {log.statusCode ? (
                    <Badge
                      variant={
                        log.statusCode >= 200 && log.statusCode < 300
                          ? "default"
                          : "destructive"
                      }
                      className="font-mono"
                    >
                      {log.statusCode}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <ProviderChainDisplay chain={log.providerChain} />
                </TableCell>
                <TableCell className="text-xs text-destructive truncate max-w-[200px]">
                  {log.errorMessage || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          第 {page} 页 / 共 {data.totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
