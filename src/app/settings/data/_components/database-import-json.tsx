"use client";

import { useState, useRef, type ReactNode } from "react";
import { Upload, Settings, FileJson, Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
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

// 导入模式类型
type ImportMode = "full" | "data" | "schema" | "selective";

// 导入配置接口
interface ImportConfig {
  mode: ImportMode;
  tables: string[];
  skipExisting: boolean;
  truncateExisting: boolean;
  validateData: boolean;
  batchSize: number;
}

// 导入结果接口
interface ImportResult {
  success: boolean;
  summary: {
    totalTables: number;
    processedTables: string[];
    totalImported: number;
    totalSkipped: number;
    totalErrors: number;
    errors: Array<{
      table: string;
      error: string;
      details?: ReactNode;
    }>;
  };
  details: {
    [tableName: string]: {
      imported: number;
      skipped: number;
      errors: number;
      errorDetails?: string[];
    };
  };
}

export function DatabaseImportJson() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  interface FilePreview {
    version: string;
    exportedAt: string;
    exportedBy: string;
    totalTables: number;
    totalRecords: number;
    tables: string[];
    summary?: {
      totalRecords: number;
    };
  }

  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<ImportConfig>({
    mode: "full",
    tables: [],
    skipExisting: false,
    truncateExisting: false,
    validateData: true,
    batchSize: 1000,
  });

  // 可导入的表
  const availableTables = [
    { value: "users", label: "用户管理", description: "用户信息和配置" },
    { value: "keys", label: "API 密钥", description: "API 密钥和权限配置" },
    { value: "providers", label: "服务供应商", description: "AI 服务供应商配置" },
    { value: "messageRequest", label: "消息请求", description: "消息请求记录" },
    { value: "modelPrices", label: "模型价格", description: "模型定价信息" },
    { value: "sensitiveWords", label: "敏感词", description: "敏感词过滤配置" },
    { value: "systemSettings", label: "系统设置", description: "系统配置信息" },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error('请选择 .json 格式的备份文件');
        return;
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB 限制
        toast.error('文件过大，最大支持 50MB');
        return;
      }

      setSelectedFile(file);
      parseFilePreview(file);
    }
  };

  const parseFilePreview = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as FilePreview;

      setFilePreview({
        version: data.version,
        exportedAt: data.exportedAt,
        exportedBy: data.exportedBy,
        totalTables: Object.keys(data.tables || {}).length,
        totalRecords: data.summary?.totalRecords || 0,
        tables: Object.keys(data.tables || {}),
      });

      // 自动选择文件中的表
      if (data.tables) {
        setConfig(prev => ({
          ...prev,
          tables: Object.keys(data.tables),
        }));
      }
    } catch (error) {
      toast.error('无法解析 JSON 文件，请检查文件格式');
      setSelectedFile(null);
      setFilePreview(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('请先选择 JSON 备份文件');
      return;
    }

    setIsImporting(true);
    setShowConfigDialog(false);

    try {
      // 读取文件内容
      const fileText = await selectedFile.text();
      const importData = JSON.parse(fileText);

      // 调用 JSON 导入 API
      const response = await fetch('/api/admin/database/import-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          data: importData,
          config,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '导入失败');
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setShowResultDialog(true);

      if (result.success) {
        toast.success('JSON 数据导入成功！', {
          description: `已导入 ${result.summary.totalImported} 条记录`,
        });
      } else {
        toast.error('部分导入失败', {
          description: `成功 ${result.summary.totalImported} 条，失败 ${result.summary.totalErrors} 条`,
        });
      }
    } catch (error) {
      console.error('JSON Import error:', error);
      toast.error(error instanceof Error ? error.message : '导入 JSON 数据失败');
    } finally {
      setIsImporting(false);
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

  const renderConfigDialog = () => (
    <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>JSON 导入配置</DialogTitle>
          <DialogDescription>
            配置 JSON 数据导入选项。请仔细检查导入设置，避免数据丢失。
          </DialogDescription>
        </DialogHeader>

        {/* 文件预览 */}
        {filePreview && (
          <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900">文件预览</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">版本:</span>
                <span className="ml-2 text-blue-900">{filePreview.version}</span>
              </div>
              <div>
                <span className="text-blue-700">导出时间:</span>
                <span className="ml-2 text-blue-900">
                  {new Date(filePreview.exportedAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-blue-700">导出者:</span>
                <span className="ml-2 text-blue-900">{filePreview.exportedBy}</span>
              </div>
              <div>
                <span className="text-blue-700">表数量:</span>
                <span className="ml-2 text-blue-900">{filePreview.totalTables}</span>
              </div>
              <div className="col-span-2">
                <span className="text-blue-700">记录总数:</span>
                <span className="ml-2 text-blue-900">{filePreview.totalRecords.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* 导入模式 */}
          <div className="space-y-2">
            <Label>导入模式</Label>
            <Select
              value={config.mode}
              onValueChange={(value: ImportMode) =>
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
                      <div className="font-medium">完整导入</div>
                      <div className="text-sm text-muted-foreground">导入所有表的结构和数据</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="data">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <div>
                      <div className="font-medium">仅数据</div>
                      <div className="text-sm text-muted-foreground">只导入数据，保留现有表结构</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="selective">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <div>
                      <div className="font-medium">选择导入</div>
                      <div className="text-sm text-muted-foreground">手动选择要导入的表</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 表选择 */}
          {config.mode === "selective" && (
            <div className="space-y-3">
              <Label>选择要导入的表</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                {availableTables
                  .filter(table => filePreview?.tables.includes(table.value))
                  .map((table) => (
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

          {/* 导入选项 */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              导入选项
            </Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="truncate-existing"
                  checked={config.truncateExisting}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({
                      ...prev,
                      truncateExisting: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor="truncate-existing" className="flex-1">
                  <span className="font-medium">清空现有数据</span>
                  <span className="text-sm text-muted-foreground block">
                    导入前删除表中的所有现有数据。⚠️ 此操作不可逆！
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-existing"
                  checked={config.skipExisting}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({
                      ...prev,
                      skipExisting: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor="skip-existing" className="flex-1">
                  <span className="font-medium">跳过冲突记录</span>
                  <span className="text-sm text-muted-foreground block">
                    跳过 ID 冲突的记录，保持现有数据不变
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="validate-data"
                  checked={config.validateData}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({
                      ...prev,
                      validateData: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor="validate-data" className="flex-1">
                  <span className="font-medium">验证数据完整性</span>
                  <span className="text-sm text-muted-foreground block">
                    检查数据格式和必需字段，确保数据质量
                  </span>
                </Label>
              </div>
            </div>
          </div>

          {/* 批量处理设置 */}
          <div className="space-y-2">
            <Label>批量处理大小</Label>
            <Input
              type="number"
              min="100"
              max="10000"
              step="100"
              value={config.batchSize}
              onChange={(e) =>
                setConfig(prev => ({
                  ...prev,
                  batchSize: parseInt(e.target.value) || 1000,
                }))
              }
            />
            <p className="text-sm text-muted-foreground">
              每批次处理的记录数，影响导入性能和内存使用
            </p>
          </div>

          {/* 警告信息 */}
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">重要提醒</p>
              <p>数据导入操作可能影响现有数据，建议在导入前创建数据库备份。</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              isImporting ||
              (config.mode === "selective" && config.tables.length === 0)
            }
          >
            {isImporting ? '正在导入...' : '开始导入'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderResultDialog = () => {
    if (!importResult) return null;

    return (
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              导入完成
            </DialogTitle>
            <DialogDescription>
              数据导入操作已完成，查看详细结果。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 总览统计 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {importResult.summary.totalTables}
                </div>
                <div className="text-sm text-muted-foreground">处理表数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.summary.totalImported.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">成功导入</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {importResult.summary.totalSkipped.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">跳过记录</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {importResult.summary.totalErrors}
                </div>
                <div className="text-sm text-muted-foreground">错误数量</div>
              </div>
            </div>

            {/* 详细结果 */}
            <div className="space-y-3">
              <h4 className="font-medium">详细结果</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">表名</th>
                      <th className="text-center p-3">成功导入</th>
                      <th className="text-center p-3">跳过</th>
                      <th className="text-center p-3">错误</th>
                      <th className="text-left p-3">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.summary.processedTables.map((tableName) => {
                      const details = importResult.details[tableName];
                      const hasErrors = details.errors > 0;

                      return (
                        <tr key={tableName} className="border-t">
                          <td className="p-3 font-medium">{tableName}</td>
                          <td className="text-center p-3">{details.imported.toLocaleString()}</td>
                          <td className="text-center p-3">{details.skipped.toLocaleString()}</td>
                          <td className="text-center p-3">{details.errors}</td>
                          <td className="p-3">
                            {hasErrors ? (
                              <div className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                <span>部分失败</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span>成功</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 错误详情 */}
            {importResult.summary.errors.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-red-600">错误详情</h4>
                <div className="border border-red-200 rounded-lg p-3 bg-red-50 max-h-60 overflow-y-auto">
                  {importResult.summary.errors.map((error, index) => (
                    <div key={index} className="text-sm mb-2">
                      <div className="font-medium text-red-800">
                        {error.table}: {error.error}
                      </div>
                      {error.details && (
                        <div className="text-red-600 text-xs mt-1">
                          {JSON.stringify(error.details, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowResultDialog(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        从 JSON 备份文件导入数据库。支持选择性导入表、数据验证和冲突处理。
        请确保 JSON 文件格式正确，并在导入前做好数据备份。
      </p>

      {/* 文件选择 */}
      <div className="space-y-2">
        <Label htmlFor="json-file">选择 JSON 备份文件</Label>
        <div className="flex items-center gap-2">
          <Input
            id="json-file"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="mr-2 h-4 w-4" />
            浏览
          </Button>
        </div>
      </div>

      {/* 文件信息 */}
      {selectedFile && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">{selectedFile.name}</p>
              <p className="text-sm text-blue-700">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {filePreview && (
              <div className="text-right text-sm text-blue-700">
                <div>{filePreview.totalTables} 个表</div>
                <div>{filePreview.totalRecords.toLocaleString()} 条记录</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 导入按钮 */}
      <Button
        onClick={() => setShowConfigDialog(true)}
        disabled={!selectedFile || isImporting}
        className="w-full sm:w-auto"
      >
        <FileJson className="mr-2 h-4 w-4" />
        {isImporting ? '正在导入...' : '配置并导入'}
      </Button>

      {renderConfigDialog()}
      {renderResultDialog()}
    </div>
  );
}