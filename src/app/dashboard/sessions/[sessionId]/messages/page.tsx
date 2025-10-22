"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Download, Check } from "lucide-react";
import { getSessionMessages } from "@/actions/active-sessions";
import { useState, useEffect } from "react";
import { Section } from "@/components/section";

/**
 * Session Messages 详情页面
 * 全屏展示单个 Session 的消息详情
 */
export default function SessionMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<unknown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getSessionMessages(sessionId);
        if (result.ok) {
          setMessages(result.data);
        } else {
          setError(result.error || "获取失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchMessages();
  }, [sessionId]);

  const handleCopy = async () => {
    if (!messages) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(messages, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  const handleDownload = () => {
    if (!messages) return;

    const jsonStr = JSON.stringify(messages, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId.substring(0, 8)}-messages.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Session Messages</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">{sessionId}</p>
          </div>
        </div>

        {/* 操作按钮 */}
        {messages !== null && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={copied}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  一键复制
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              一键下载
            </Button>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <Section title="详细信息" description="查看完整的 Session Messages 数据">
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">加载中...</div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="text-destructive text-lg mb-2">{error}</div>
              {error.includes("未存储") && (
                <p className="text-sm text-muted-foreground">
                  提示：请设置环境变量 STORE_SESSION_MESSAGES=true 以启用 messages 存储
                </p>
              )}
            </div>
          ) : messages ? (
            <div className="rounded-md border bg-muted/50 p-6">
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(messages, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">暂无数据</div>
          )}
        </div>
      </Section>
    </div>
  );
}
