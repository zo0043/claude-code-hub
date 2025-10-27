"use client";

import { useState } from "react";
import { Download, Settings, FileJson, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// 导出模式类型
type ExportMode = "full" | "schema" | "data" | "selective";

// 导出配置接口
interface ExportConfig {
  mode: ExportMode;
  tables: string[];
  includeSensitiveData: boolean;
  maxRecords: number;
}

export function DatabaseExportJson() {
  const [isExporting, setIsExporting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [config, setConfig] = useState<ExportConfig>({
    mode: "full",
    tables: [],
    includeSensitiveData: false,
    maxRecords: 0,
  });

  // 可导出的表
  const availableTables = [
    { value: "users", label: "用户管理", description: "用户信息和配置" },
    { value: "keys", label: "API 密钥", description: "API 密钥和权限配置" },
    { value: "providers", label: "服务供应商", description: "AI 服务供应商配置" },
    { value: "messageRequest", label: "消息请求", description: "消息请求记录" },
    { value: "modelPrices", label: "模型价格", description: "模型定价信息" },
    { value: "sensitiveWords", label: "敏感词", description: "敏感词过滤配置" },
    { value: "systemSettings", label: "系统设置", description: "系统配置信息" },
  ];

  const handleExport = async (finalConfig: ExportConfig = config) => {
    setIsExporting(true);
    setShowConfigDialog(false);

    try {
      // 调用 JSON 导出 API
      const response = await fetch('/api/admin/database/export-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(finalConfig),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '导出失败');
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `database_export_${new Date().toISOString().slice(0, -5)}.json`;

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('JSON 数据库导出成功！', {
        description: `已导出 ${finalConfig.tables.length} 个表的数据`,
      });
    } catch (error) {
      console.error('JSON Export error:', error);
      toast.error(error instanceof Error ? error.message : '导出 JSON 数据失败');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTableToggle = (tableValue: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      tables: checked
        ? [...prev.tables, tableValue]
        : prev.tables.filter(t => t !== tableValue),
    }));
  };

  const handleSelectAll = () => {
    setConfig(prev => ({
      ...prev,
      tables: availableTables.map(t => t.value),
    }));
  };

  const handleSelectNone = () => {
    setConfig(prev => ({
      ...prev,
      tables: [],
    }));
  };

  const renderConfigDialog = () => (
    <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>JSON 导出配置</DialogTitle>
          <DialogDescription>
            选择要导出的表和导出模式。JSON 格式适合数据迁移、备份和分析。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 导出模式 */}
          <div className="space-y-2">
            <Label>导出模式</Label>
            <Select
              value={config.mode}
              onValueChange={(value: ExportMode) =>
                setConfig(prev => ({ ...prev, mode: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    <div>
                      <div className="font-medium">完整导出</div>
                      <div className="text-sm text-muted-foreground">导出所有表的结构和数据</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="schema">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <div>
                      <div className="font-medium">仅结构</div>
                      <div className="text-sm text-muted-foreground">只导出表结构，不导出数据</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="data">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <div>
                      <div className="font-medium">仅数据</div>
                      <div className="text-sm text-muted-foreground">只导出数据，不包括表结构</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="selective">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    <div>
                      <div className="font-medium">选择导出</div>
                      <div className="text-sm text-muted-foreground">手动选择要导出的表</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 表选择 */}
          {config.mode === "selective" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>选择要导出的表</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectNone}>
                    清空
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    全选
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                {availableTables.map((table) => (
                  <div key={table.value} className="flex items-start space-x-2">
                    <Checkbox
                      id={table.value}
                      checked={config.tables.includes(table.value)}
                      onCheckedChange={(checked) =>
                        handleTableToggle(table.value, checked as boolean)
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor={table.value} className="font-medium">
                        {table.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {table.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 安全选项 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                安全选项
              </Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-sensitive-data"
                    checked={config.includeSensitiveData}
                    onCheckedChange={(checked) =>
                      setConfig(prev => ({
                        ...prev,
                        includeSensitiveData: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="include-sensitive-data" className="flex-1">
                    <span className="font-medium">包含敏感数据</span>
                    <span className="text-sm text-muted-foreground block">
                      导出 API 密钥等敏感信息。请谨慎使用此选项。
                    </span>
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* 限制选项 */}
          <div className="space-y-2">
            <Label>记录限制（可选）</Label>
            <Input
              type="number"
              placeholder="0 = 无限制"
              min="0"
              max="100000"
              value={config.maxRecords || ""}
              onChange={(e) =>
                setConfig(prev => ({
                  ...prev,
                  maxRecords: parseInt(e.target.value) || 0,
                }))
              }
            />
            <p className="text-sm text-muted-foreground">
              限制每个表导出的记录数，用于测试或部分导出
            </p>
          </div>

          {/* 警告信息 */}
          {config.mode === "selective" && config.tables.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                选择导出模式下至少需要选择一个表
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
            取消
          </Button>
          <Button
            onClick={() => handleExport(config)}
            disabled={
              (config.mode === "selective" && config.tables.length === 0)
            }
          >
            开始导出
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        导出数据库为 JSON 格式，适合数据迁移、备份和分析。JSON 格式人类可读，
        支持选择性导出表和数据，便于版本控制和数据转换。
      </p>

      <div className="flex gap-2">
        <Button
          onClick={() => setShowConfigDialog(true)}
          disabled={isExporting}
          className="flex-1 sm:flex-none"
        >
          <FileJson className="mr-2 h-4 w-4" />
          {isExporting ? '正在导出...' : 'JSON 导出'}
        </Button>
      </div>

      {renderConfigDialog()}
    </div>
  );
}