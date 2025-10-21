import type { ProviderChainItem } from "@/types/message";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProviderChainDisplayProps {
  chain?: ProviderChainItem[];
}

/**
 * 决策链展示组件
 * 显示上游供应商的切换过程
 * 单个供应商：直接显示名称
 * 多个供应商：用箭头连接，并显示详细元数据
 */
export function ProviderChainDisplay({ chain }: ProviderChainDisplayProps) {
  if (!chain || chain.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  // 单个供应商
  if (chain.length === 1) {
    const provider = chain[0];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="font-mono cursor-help">
              {/* ✅ 熔断状态图标 */}
              {provider.circuitState === 'open' && '🔴 '}
              {provider.circuitState === 'half-open' && '🟡 '}
              {provider.name}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs space-y-1">
              <div><strong>供应商:</strong> {provider.name} (ID: {provider.id})</div>
              {provider.reason && <div><strong>选择原因:</strong> {provider.reason}</div>}
              {provider.circuitState && <div><strong>熔断状态:</strong> {provider.circuitState}</div>}
              {provider.priority !== undefined && <div><strong>优先级:</strong> {provider.priority}</div>}
              {provider.weight !== undefined && <div><strong>权重:</strong> {provider.weight}</div>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 多个供应商（有重试）
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 flex-wrap">
        {chain.map((provider, index) => (
          <div key={`${provider.id}-${index}`} className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={index === chain.length - 1 ? "default" : "secondary"}
                  className="font-mono cursor-help"
                >
                  {/* ✅ 熔断状态图标 */}
                  {provider.circuitState === 'open' && '🔴 '}
                  {provider.circuitState === 'half-open' && '🟡 '}
                  {provider.name}
                  {/* ✅ 尝试次数 */}
                  {provider.attemptNumber && (
                    <span className="ml-1 text-[10px] opacity-70">
                      #{provider.attemptNumber}
                    </span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="text-xs space-y-1">
                  <div><strong>供应商:</strong> {provider.name} (ID: {provider.id})</div>
                  {provider.attemptNumber && <div><strong>尝试次数:</strong> 第 {provider.attemptNumber} 次</div>}
                  {provider.reason && <div><strong>选择原因:</strong> {provider.reason}</div>}
                  {provider.circuitState && <div><strong>熔断状态:</strong> {provider.circuitState}</div>}
                  {provider.priority !== undefined && <div><strong>优先级:</strong> {provider.priority}</div>}
                  {provider.weight !== undefined && <div><strong>权重:</strong> {provider.weight}</div>}
                  {provider.costMultiplier !== undefined && <div><strong>成本倍率:</strong> {provider.costMultiplier}x</div>}
                  {provider.timestamp && <div><strong>时间:</strong> {new Date(provider.timestamp).toLocaleTimeString()}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
            {index < chain.length - 1 && (
              <span className="text-muted-foreground text-xs">→</span>
            )}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
