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
import type { UsageLogRow } from "@/repository/usage-logs";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ProviderChainPopover } from "./provider-chain-popover";
import { ErrorDetailsDialog } from "./error-details-dialog";

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
              <TableHead className="text-right">输入</TableHead>
              <TableHead className="text-right">输出</TableHead>
              <TableHead className="text-right">缓存写入</TableHead>
              <TableHead className="text-right">缓存读取</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead className="text-right">耗时</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
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
                  <TableCell>
                    {log.providerChain && log.providerChain.length > 0 ? (
                      <ProviderChainPopover
                        chain={log.providerChain}
                        finalProvider={log.providerName}
                      />
                    ) : (
                      log.providerName
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.model || "-"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.inputTokens?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.outputTokens?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.cacheCreationInputTokens?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.cacheReadInputTokens?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.costUsd ? `$${parseFloat(log.costUsd).toFixed(6)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {log.durationMs ? `${log.durationMs}ms` : "-"}
                  </TableCell>
                  <TableCell>
                    <ErrorDetailsDialog
                      statusCode={log.statusCode}
                      errorMessage={log.errorMessage}
                      providerChain={log.providerChain}
                      sessionId={log.sessionId}
                    />
                  </TableCell>
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
