"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ActiveSessionInfo } from "@/types/session";
import { SessionMessagesDialog } from "./session-messages-dialog";

interface ActiveSessionsTableProps {
  sessions: ActiveSessionInfo[];
  isLoading: boolean;
}

function formatDuration(durationMs: number | undefined): string {
  if (!durationMs) return "-";

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

function getStatusBadge(status: 'in_progress' | 'completed' | 'error', statusCode?: number) {
  if (status === 'in_progress') {
    return <Badge variant="default" className="bg-blue-500">进行中</Badge>;
  } else if (status === 'error' || (statusCode && statusCode >= 400)) {
    return <Badge variant="destructive">错误</Badge>;
  } else {
    return <Badge variant="outline" className="text-green-600 border-green-600">完成</Badge>;
  }
}

export function ActiveSessionsTable({
  sessions,
  isLoading,
}: ActiveSessionsTableProps) {
  // 按开始时间降序排序（最新的在前）
  const sortedSessions = [...sessions].sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {sessions.length} 个活跃 Session
        </div>
        {isLoading && (
          <div className="text-sm text-muted-foreground animate-pulse">
            刷新中...
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session ID</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead>模型</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="text-right">持续时长</TableHead>
              <TableHead className="text-right">输入</TableHead>
              <TableHead className="text-right">输出</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  暂无活跃 Session
                </TableCell>
              </TableRow>
            ) : (
              sortedSessions.map((session) => (
                <TableRow key={session.sessionId}>
                  <TableCell className="font-mono text-xs">
                    {session.sessionId.substring(0, 16)}...
                  </TableCell>
                  <TableCell>{session.userName}</TableCell>
                  <TableCell className="font-mono text-xs">{session.keyName}</TableCell>
                  <TableCell>{session.providerName || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{session.model || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {session.apiType === 'codex' ? 'Codex' : 'Chat'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatDuration(session.durationMs)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {session.inputTokens?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {session.outputTokens?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {session.costUsd ? `$${parseFloat(session.costUsd).toFixed(6)}` : "-"}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(session.status, session.statusCode)}
                  </TableCell>
                  <TableCell className="text-center">
                    <SessionMessagesDialog sessionId={session.sessionId} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
