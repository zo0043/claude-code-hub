import type { ProviderChainItem } from "@/types/message";
import { Badge } from "@/components/ui/badge";

interface ProviderChainDisplayProps {
  chain?: ProviderChainItem[];
}

/**
 * 决策链展示组件
 * 显示上游供应商的切换过程
 * 单个供应商：直接显示名称
 * 多个供应商：用箭头连接
 */
export function ProviderChainDisplay({ chain }: ProviderChainDisplayProps) {
  if (!chain || chain.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  // 单个供应商
  if (chain.length === 1) {
    return (
      <Badge variant="outline" className="font-mono">
        {chain[0].name}
      </Badge>
    );
  }

  // 多个供应商（有重试）
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {chain.map((provider, index) => (
        <div key={`${provider.id}-${index}`} className="flex items-center gap-1">
          <Badge
            variant={index === chain.length - 1 ? "default" : "secondary"}
            className="font-mono"
          >
            {provider.name}
          </Badge>
          {index < chain.length - 1 && (
            <span className="text-muted-foreground text-xs">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
