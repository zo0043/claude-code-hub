"use client";

import { useEffect, useState } from "react";
import { Database, Server, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DatabaseStatus } from "@/types/database-backup";

export function DatabaseStatusDisplay() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 从 cookie 中获取 admin token
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin_token='))
        ?.split('=')[1];

      if (!token) {
        setError('未登录或会话已过期');
        return;
      }

      const response = await fetch('/api/admin/database/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取状态失败');
      }

      const data: DatabaseStatus = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Fetch status error:', err);
      setError(err instanceof Error ? err.message : '获取数据库状态失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus}>
          重试
        </Button>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 连接状态 */}
      <div className="flex items-center gap-2">
        {status.isAvailable ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">数据库连接正常</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium text-orange-500">数据库不可用</span>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={fetchStatus} className="ml-auto">
          刷新
        </Button>
      </div>

      {/* 错误信息 */}
      {status.error && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
          {status.error}
        </div>
      )}

      {/* 数据库信息 */}
      {status.isAvailable && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="h-4 w-4" />
              <span className="text-xs font-medium">数据库大小</span>
            </div>
            <p className="text-lg font-semibold">{status.databaseSize}</p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Server className="h-4 w-4" />
              <span className="text-xs font-medium">表数量</span>
            </div>
            <p className="text-lg font-semibold">{status.tableCount} 个</p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 col-span-2">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Server className="h-4 w-4" />
              <span className="text-xs font-medium">PostgreSQL 版本</span>
            </div>
            <p className="text-sm font-semibold">{status.postgresVersion}</p>
          </div>
        </div>
      )}

      {/* 详细信息 */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>容器名称: <span className="font-mono">{status.containerName}</span></p>
        <p>数据库名称: <span className="font-mono">{status.databaseName}</span></p>
      </div>
    </div>
  );
}
