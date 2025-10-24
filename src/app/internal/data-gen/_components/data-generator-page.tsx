"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Download, FileDown, Loader2, Settings } from "lucide-react";
import type { GeneratorResult } from "@/lib/data-generator/types";

export function DataGeneratorPage() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [totalCostCny, setTotalCostCny] = useState<string>("");
  const [totalRecords, setTotalRecords] = useState<string>("");
  const [models, setModels] = useState<string>("");
  const [userIds, setUserIds] = useState<string>("");
  const [providerIds, setProviderIds] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [showParams, setShowParams] = useState(true);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        startDate,
        endDate,
      };

      if (totalCostCny) {
        payload.totalCostCny = parseFloat(totalCostCny);
      }
      if (totalRecords) {
        payload.totalRecords = parseInt(totalRecords, 10);
      }
      if (models) {
        payload.models = models
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);
      }
      if (userIds) {
        payload.userIds = userIds
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter(Number.isInteger);
      }
      if (providerIds) {
        payload.providerIds = providerIds
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter(Number.isInteger);
      }

      const response = await fetch("/api/internal/data-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate logs");
      }

      const data: GeneratorResult = await response.json();
      setResult(data);
      setShowParams(false); // 生成成功后自动关闭参数框
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const element = document.getElementById("export-content");
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`data-generator-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExportScreenshot = async () => {
    const html2canvas = (await import("html2canvas")).default;

    const element = document.getElementById("export-content");
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data-generator-${new Date().toISOString().split("T")[0]}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6 p-6">
      {!showParams && result && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowParams(true)}>
            <Settings className="mr-2 h-4 w-4" />
            重新配置参数
          </Button>
        </div>
      )}

      {showParams && (
        <Card>
          <CardHeader>
            <CardTitle>生成参数</CardTitle>
            <CardDescription>配置生成参数以创建模拟日志数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">起始时间 *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">结束时间 *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalCostCny">总金额（人民币）</Label>
                <Input
                  id="totalCostCny"
                  type="number"
                  placeholder="如：1000"
                  value={totalCostCny}
                  onChange={(e) => setTotalCostCny(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalRecords">总记录数</Label>
                <Input
                  id="totalRecords"
                  type="number"
                  placeholder="如：500（不填则根据金额计算）"
                  value={totalRecords}
                  onChange={(e) => setTotalRecords(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="models">包含模型（逗号分隔）</Label>
                <Input
                  id="models"
                  placeholder="如：claude-3-5-sonnet,gpt-4（留空则全部）"
                  value={models}
                  onChange={(e) => setModels(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userIds">用户ID（逗号分隔）</Label>
                <Input
                  id="userIds"
                  placeholder="如：1,2,3（留空则全部）"
                  value={userIds}
                  onChange={(e) => setUserIds(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="providerIds">供应商ID（逗号分隔）</Label>
                <Input
                  id="providerIds"
                  placeholder="如：1,2（留空则全部）"
                  value={providerIds}
                  onChange={(e) => setProviderIds(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleGenerate} disabled={loading || !startDate || !endDate}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              生成数据
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div id="export-content" className="space-y-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExportScreenshot}>
              <Download className="mr-2 h-4 w-4" />
              导出截图
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="mr-2 h-4 w-4" />
              导出 PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>总记录数</CardDescription>
                <CardTitle className="text-2xl">
                  {result.summary.totalRecords.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>总成本</CardDescription>
                <CardTitle className="text-2xl">${result.summary.totalCost.toFixed(4)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>总成本（人民币）</CardDescription>
                <CardTitle className="text-2xl">
                  ¥{(result.summary.totalCost * 7.1).toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>总 Token</CardDescription>
                <CardTitle className="text-2xl">
                  {result.summary.totalTokens.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>使用日志</CardTitle>
              <CardDescription>共 {result.logs.length} 条记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>密钥</TableHead>
                      <TableHead>供应商</TableHead>
                      <TableHead>模型</TableHead>
                      <TableHead className="text-right">输入</TableHead>
                      <TableHead className="text-right">输出</TableHead>
                      <TableHead className="text-right">缓存写</TableHead>
                      <TableHead className="text-right">缓存读</TableHead>
                      <TableHead className="text-right">成本</TableHead>
                      <TableHead className="text-right">耗时</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {log.createdAt.toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell>{log.userName}</TableCell>
                        <TableCell className="font-mono text-xs">{log.keyName}</TableCell>
                        <TableCell>{log.providerName}</TableCell>
                        <TableCell className="font-mono text-xs">{log.model}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {log.inputTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {log.outputTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {log.cacheCreationInputTokens > 0
                            ? log.cacheCreationInputTokens.toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {log.cacheReadInputTokens > 0
                            ? log.cacheReadInputTokens.toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ${parseFloat(log.costUsd).toFixed(6)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {log.durationMs >= 1000
                            ? `${(log.durationMs / 1000).toFixed(2)}s`
                            : `${log.durationMs}ms`}
                        </TableCell>
                        <TableCell>
                          {log.statusCode === 200 ? (
                            <span className="inline-flex items-center rounded-md bg-green-100 dark:bg-green-950 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                              成功
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-red-100 dark:bg-red-950 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300">
                              {log.statusCode}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
