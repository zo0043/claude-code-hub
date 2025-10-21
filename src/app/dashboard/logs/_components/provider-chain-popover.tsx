"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoIcon, ChevronRightIcon } from "lucide-react";

interface ProviderChainItem {
  id: number;
  name: string;
  reason?: 'initial_selection' | 'retry_attempt' | 'retry_fallback' | 'reuse';
  selectionMethod?: 'reuse' | 'random' | 'group_filter' | 'fallback';
  priority?: number;
  weight?: number;
  costMultiplier?: number;
  groupTag?: string | null;
  circuitState?: 'closed' | 'open' | 'half-open';
  timestamp?: number;
  attemptNumber?: number;
}

interface ProviderChainPopoverProps {
  chain: ProviderChainItem[];
  finalProvider: string;
}

const reasonLabels: Record<string, string> = {
  initial_selection: '初始选择',
  retry_attempt: '重试尝试',
  retry_fallback: '降级重试',
  reuse: '会话复用',
};

const selectionMethodLabels: Record<string, string> = {
  reuse: '复用',
  random: '加权随机',
  group_filter: '分组筛选',
  fallback: '降级',
};

const circuitStateLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  closed: { label: '正常', variant: 'default' },
  open: { label: '熔断', variant: 'destructive' },
  'half-open': { label: '半开', variant: 'secondary' },
};

export function ProviderChainPopover({ chain, finalProvider }: ProviderChainPopoverProps) {
  // 如果只有一个供应商,不显示 popover
  if (chain.length <= 1) {
    return <span>{finalProvider}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 font-normal hover:bg-transparent">
          <span className="flex items-center gap-1">
            {finalProvider}
            <Badge variant="secondary" className="ml-1">
              {chain.length} 次
            </Badge>
            <InfoIcon className="h-3 w-3 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">供应商决策链</h4>
            <Badge variant="outline">{chain.length} 次尝试</Badge>
          </div>

          <div className="space-y-2">
            {chain.map((item, index) => (
              <div key={index} className="space-y-2">
                {/* 箭头连接符 */}
                {index > 0 && (
                  <div className="flex items-center justify-center">
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground rotate-90" />
                  </div>
                )}

                {/* 供应商信息卡片 */}
                <div className="rounded-md border p-3 space-y-2 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.name}</span>
                      {item.attemptNumber && (
                        <Badge variant="outline" className="text-xs">
                          第 {item.attemptNumber} 次
                        </Badge>
                      )}
                    </div>
                    {item.circuitState && circuitStateLabels[item.circuitState] && (
                      <Badge variant={circuitStateLabels[item.circuitState].variant} className="text-xs">
                        {circuitStateLabels[item.circuitState].label}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {item.reason && (
                      <div>
                        <span className="font-medium">原因:</span> {reasonLabels[item.reason] || item.reason}
                      </div>
                    )}
                    {item.selectionMethod && (
                      <div>
                        <span className="font-medium">方法:</span> {selectionMethodLabels[item.selectionMethod] || item.selectionMethod}
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
                        <span className="font-medium">成本系数:</span> {item.costMultiplier}x
                      </div>
                    )}
                    {item.groupTag && (
                      <div className="col-span-2">
                        <span className="font-medium">分组:</span> {item.groupTag}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
