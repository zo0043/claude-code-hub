"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UsageLogRow } from "@/repository/usage-logs";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface UsageLogsTableProps {
  logs: UsageLogRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isPending: boolean;
}

export function UsageLogsTable({
  logs,
  total,
  page,
  pageSize,
  onPageChange,
  isPending,
}: UsageLogsTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  const getStatusBadge = (statusCode: number | null) => {
    if (!statusCode) return <Badge variant="secondary">-</Badge>;

    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="default">{statusCode}</Badge>;
    } else if (statusCode >= 400 && statusCode < 500) {
      return <Badge variant="destructive">{statusCode}</Badge>;
    } else if (statusCode >= 500) {
      return <Badge variant="destructive">{statusCode}</Badge>;
    }

    return <Badge variant="secondary">{statusCode}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="text-right">Token</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead className="text-right">耗时</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">
                    {log.createdAt ? formatDistanceToNow(log.createdAt, {
                      addSuffix: true,
                      locale: zhCN,
                    }) : '-'}
                  </TableCell>
                  <TableCell>{log.userName}</TableCell>
                  <TableCell className="font-mono text-xs">{log.keyName}</TableCell>
                  <TableCell>{log.providerName}</TableCell>
                  <TableCell className="font-mono text-xs">{log.model || "-"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.totalTokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.costUsd ? `$${parseFloat(log.costUsd).toFixed(6)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.durationMs ? `${log.durationMs}ms` : "-"}
                  </TableCell>
                  <TableCell>{getStatusBadge(log.statusCode)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 条记录，第 {page} / {totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || isPending}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages || isPending}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
