"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import type { ProviderChainItem } from "@/types/message";
import { hasSessionMessages } from "@/actions/active-sessions";

interface ErrorDetailsDialogProps {
  statusCode: number | null;
  errorMessage: string | null;
  providerChain: ProviderChainItem[] | null;
  sessionId: string | null;
  blockedBy?: string | null; // 新增：拦截类型
  blockedReason?: string | null; // 新增：拦截原因（JSON 字符串）
}

const reasonLabels: Record<string, string> = {
  initial_selection: '初始选择',
  retry_attempt: '重试尝试',
  retry_fallback: '降级重试',
  reuse: '会话复用',
};

const blockedByLabels: Record<string, string> = {
  sensitive_word: '敏感词拦截',
};

const circuitStateLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  closed: { label: '正常', variant: 'default' },
  open: { label: '熔断', variant: 'destructive' },
  'half-open': { label: '半开', variant: 'secondary' },
};

export function ErrorDetailsDialog({
  statusCode,
  errorMessage,
  providerChain,
  sessionId,
  blockedBy,
  blockedReason,
}: ErrorDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);
  const [checkingMessages, setCheckingMessages] = useState(false);

  const isSuccess = statusCode && statusCode >= 200 && statusCode < 300;
  const isError = statusCode && (statusCode >= 400 || statusCode < 200);
  const isInProgress = !statusCode; // 没有状态码表示请求进行中
  const isBlocked = !!blockedBy; // 是否被拦截

  // 解析 blockedReason JSON
  let parsedBlockedReason: { word?: string; matchType?: string; matchedText?: string } | null = null;
  if (blockedReason) {
    try {
      parsedBlockedReason = JSON.parse(blockedReason);
    } catch (e) {
      // 解析失败，忽略
    }
  }

  // 检查 session 是否有 messages 数据
  useEffect(() => {
    if (open && sessionId) {
      setCheckingMessages(true);
      hasSessionMessages(sessionId)
        .then((result) => {
          if (result.ok) {
            setHasMessages(result.data);
          }
        })
        .catch((err) => {
          console.error('Failed to check session messages:', err);
        })
        .finally(() => {
          setCheckingMessages(false);
        });
    } else {
      // 弹窗关闭时重置状态
      setHasMessages(false);
      setCheckingMessages(false);
    }
  }, [open, sessionId]);

  const getStatusBadgeVariant = () => {
    if (isInProgress) return "outline"; // 请求中使用 outline 样式
    if (isSuccess) return "default";
    if (isError) return "destructive";
    return "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto p-0 font-normal hover:bg-transparent"
        >
          <Badge variant={getStatusBadgeVariant()} className="cursor-pointer">
            {isInProgress ? "请求中" : statusCode}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInProgress ? (
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            ) : isSuccess ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            请求详情 - 状态码 {isInProgress ? "请求中" : statusCode || "未知"}
          </DialogTitle>
          <DialogDescription>
            {isInProgress
              ? "请求正在进行中，尚未完成"
              : isSuccess
              ? "请求成功完成"
              : "请求失败，以下是详细的错误信息和供应商决策链"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* 拦截信息 */}
          {isBlocked && blockedBy && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                拦截信息
              </h4>
              <div className="rounded-md border bg-orange-50 dark:bg-orange-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-orange-900 dark:text-orange-100">
                    拦截类型:
                  </span>
                  <Badge variant="outline" className="border-orange-600 text-orange-600">
                    {blockedByLabels[blockedBy] || blockedBy}
                  </Badge>
                </div>
                {parsedBlockedReason && (
                  <div className="space-y-1 text-xs">
                    {parsedBlockedReason.word && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-orange-900 dark:text-orange-100">
                          敏感词:
                        </span>
                        <code className="bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded text-orange-900 dark:text-orange-100">
                          {parsedBlockedReason.word}
                        </code>
                      </div>
                    )}
                    {parsedBlockedReason.matchType && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-orange-900 dark:text-orange-100">
                          匹配类型:
                        </span>
                        <span className="text-orange-800 dark:text-orange-200">
                          {parsedBlockedReason.matchType === 'contains' && '包含匹配'}
                          {parsedBlockedReason.matchType === 'exact' && '精确匹配'}
                          {parsedBlockedReason.matchType === 'regex' && '正则表达式'}
                        </span>
                      </div>
                    )}
                    {parsedBlockedReason.matchedText && (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-orange-900 dark:text-orange-100">
                          匹配内容:
                        </span>
                        <pre className="bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded text-orange-900 dark:text-orange-100 whitespace-pre-wrap break-words">
                          {parsedBlockedReason.matchedText}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session 信息 */}
          {sessionId && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">会话 ID</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-md border bg-muted/50 p-3">
                  <code className="text-xs font-mono break-all">
                    {sessionId}
                  </code>
                </div>
                {hasMessages && !checkingMessages && (
                  <Link href={`/dashboard/sessions/${sessionId}/messages`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      查看详情
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* 最终错误信息 */}
          {errorMessage && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                错误信息
              </h4>
              <div className="rounded-md border bg-destructive/10 p-4">
                <pre className="text-xs text-destructive whitespace-pre-wrap break-words font-mono">
                  {errorMessage}
                </pre>
              </div>
            </div>
          )}

          {/* 供应商决策链（带错误信息） */}
          {providerChain && providerChain.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">供应商决策链</h4>
              <div className="text-xs text-muted-foreground mb-2">
                共尝试 {providerChain.length} 个供应商
              </div>

              <div className="space-y-3">
                {providerChain.map((item, index) => (
                  <div key={index} className="space-y-2">
                    {/* 箭头连接符 */}
                    {index > 0 && (
                      <div className="flex items-center justify-center">
                        <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                      </div>
                    )}

                    {/* 供应商信息卡片 */}
                    <div className="rounded-md border p-4 space-y-3 bg-muted/50">
                      {/* 标题行 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {item.attemptNumber && (
                            <Badge variant="outline" className="text-xs">
                              第 {item.attemptNumber} 次尝试
                            </Badge>
                          )}
                        </div>
                        {item.circuitState && circuitStateLabels[item.circuitState] && (
                          <Badge
                            variant={circuitStateLabels[item.circuitState].variant}
                            className="text-xs"
                          >
                            {circuitStateLabels[item.circuitState].label}
                          </Badge>
                        )}
                      </div>

                      {/* 供应商配置信息 */}
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        {item.reason && (
                          <div>
                            <span className="font-medium">原因:</span>{" "}
                            {reasonLabels[item.reason] || item.reason}
                          </div>
                        )}
                        {item.weight !== undefined && (
                          <div>
                            <span className="font-medium">权重:</span> {item.weight}
                          </div>
                        )}
                        {item.priority !== undefined && (
                          <div>
                            <span className="font-medium">优先级:</span> {item.priority}
                          </div>
                        )}
                        {item.costMultiplier !== undefined && (
                          <div>
                            <span className="font-medium">成本系数:</span>{" "}
                            {item.costMultiplier}x
                          </div>
                        )}
                        {item.groupTag && (
                          <div className="col-span-2">
                            <span className="font-medium">分组:</span> {item.groupTag}
                          </div>
                        )}
                      </div>

                      {/* 错误信息（如果有） */}
                      {item.errorMessage && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            失败原因
                          </div>
                          <div className="rounded-md bg-destructive/10 p-2 border border-destructive/20">
                            <pre className="text-xs text-destructive whitespace-pre-wrap break-words font-mono">
                              {item.errorMessage}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 无错误信息的情况 */}
          {!errorMessage && (!providerChain || providerChain.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              {isInProgress
                ? "请求正在处理中，等待响应..."
                : isSuccess
                ? "请求成功，无错误信息"
                : "暂无详细错误信息"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
