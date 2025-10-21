"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Globe, Key } from "lucide-react";
import type { ProviderDisplay } from "@/types/provider";
import type { User } from "@/types/user";
import { ProviderForm } from "./forms/provider-form";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { PROVIDER_LIMITS } from "@/lib/constants/provider.constants";
import { FormErrorBoundary } from "@/components/form-error-boundary";
import { useProviderEdit } from "./hooks/use-provider-edit";

interface ProviderListItemProps {
  item: ProviderDisplay;
  currentUser?: User;
}

export function ProviderListItem({ item, currentUser }: ProviderListItemProps) {
  const [openEdit, setOpenEdit] = useState(false);
  const canEdit = currentUser?.role === 'admin';

  const {
    enabled,
    togglePending,
    weight,
    setWeight,
    showWeight,
    limit5hInfinite,
    setLimit5hInfinite,
    limit5hValue,
    setLimit5hValue,
    show5hLimit,
    limitWeeklyInfinite,
    setLimitWeeklyInfinite,
    limitWeeklyValue,
    setLimitWeeklyValue,
    showWeeklyLimit,
    limitMonthlyInfinite,
    setLimitMonthlyInfinite,
    limitMonthlyValue,
    setLimitMonthlyValue,
    showMonthlyLimit,
    concurrentInfinite,
    setConcurrentInfinite,
    concurrentValue,
    setConcurrentValue,
    showConcurrent,
    handleToggle,
    handleWeightPopover,
    handle5hLimitPopover,
    handleWeeklyLimitPopover,
    handleMonthlyLimitPopover,
    handleConcurrentPopover,
  } = useProviderEdit(item, canEdit);

  return (
    <div className="group relative h-full rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-border focus-within:ring-1 focus-within:ring-primary/20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold ${enabled ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
              ●
            </span>
            <h3 className="text-sm font-semibold text-foreground truncate tracking-tight">{item.name}</h3>
            {/* 编辑按钮 - 仅管理员可见 */}
            {canEdit && (
              <Dialog open={openEdit} onOpenChange={setOpenEdit}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    aria-label="编辑服务商"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <FormErrorBoundary>
                    <ProviderForm mode="edit" provider={item} onSuccess={() => setOpenEdit(false)} />
                  </FormErrorBoundary>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>启用</span>
            <Switch
              aria-label="启用服务商"
              checked={enabled}
              disabled={!canEdit || togglePending}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>
      </div>

      {/* 内容区改为上下结构 */}
      <div className="space-y-3 mb-3">
        {/* 上：URL 与密钥 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="font-mono text-muted-foreground truncate">{item.url}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Key className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="font-mono text-muted-foreground">{item.maskedKey}</span>
          </div>
        </div>

        {/* 路由配置 */}
        <div className="grid grid-cols-4 gap-2 text-[11px] pb-2 border-b border-border/40">
          {/* 优先级 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">优先级</div>
            <div className="w-full text-center font-medium tabular-nums truncate text-foreground">
              <span>{item.priority}</span>
            </div>
          </div>

          {/* 权重 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">权重</div>
            {canEdit ? (
              <Popover open={showWeight} onOpenChange={handleWeightPopover}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="编辑权重"
                    className="w-full text-center font-medium tabular-nums truncate text-foreground cursor-pointer hover:text-primary/80 transition-colors"
                  >
                    <span>{weight}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" side="bottom" sideOffset={6} className="w-64 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>调整权重</span>
                    <span className="font-medium text-foreground">{weight}</span>
                  </div>
                  <Slider min={PROVIDER_LIMITS.WEIGHT.MIN} max={PROVIDER_LIMITS.WEIGHT.MAX} step={1} value={[weight]} onValueChange={(v) => setWeight(v?.[0] ?? PROVIDER_LIMITS.WEIGHT.MIN)} />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="w-full text-center font-medium tabular-nums truncate text-foreground">
                <span>{weight}</span>
              </div>
            )}
          </div>

          {/* 成本 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">成本/M</div>
            <div className="w-full text-center font-medium tabular-nums truncate text-foreground">
              <span>{item.costPerMtok ? `$${item.costPerMtok.toFixed(4)}` : '-'}</span>
            </div>
          </div>

          {/* 分组 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">分组</div>
            <div className="w-full text-center font-medium truncate text-foreground">
              <span>{item.groupTag || '-'}</span>
            </div>
          </div>
        </div>

        {/* 限流配置 */}
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          {/* 5小时消费上限 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">5h USD</div>
            {canEdit ? (
              <Popover open={show5hLimit} onOpenChange={handle5hLimitPopover}>
                <PopoverTrigger asChild>
                  <button type="button" className="w-full text-center font-medium tabular-nums truncate text-foreground hover:text-primary/80 transition-colors cursor-pointer">
                    <span>{limit5hInfinite ? "∞" : `$${limit5hValue.toFixed(2)}`}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" side="bottom" sideOffset={6} className="w-72 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">5小时消费上限 (USD)</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>无限</span>
                      <Switch checked={limit5hInfinite} onCheckedChange={setLimit5hInfinite} aria-label="无限" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={PROVIDER_LIMITS.LIMIT_5H_USD.MIN}
                      max={PROVIDER_LIMITS.LIMIT_5H_USD.MAX}
                      step={PROVIDER_LIMITS.LIMIT_5H_USD.STEP}
                      value={[limit5hValue]}
                      onValueChange={(v) => !limit5hInfinite && setLimit5hValue(v?.[0] ?? PROVIDER_LIMITS.LIMIT_5H_USD.MIN)}
                      disabled={limit5hInfinite}
                    />
                    <span className="w-16 text-right text-xs font-medium">{limit5hInfinite ? "∞" : `$${limit5hValue.toFixed(2)}`}</span>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="w-full text-center font-medium tabular-nums truncate text-foreground">
                <span>{limit5hInfinite ? "∞" : `$${limit5hValue.toFixed(2)}`}</span>
              </div>
            )}
          </div>

          {/* 周消费上限 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">Week USD</div>
            {canEdit ? (
              <Popover open={showWeeklyLimit} onOpenChange={handleWeeklyLimitPopover}>
                <PopoverTrigger asChild>
                  <button type="button" className="w-full text-center font-medium tabular-nums truncate text-foreground hover:text-primary/80 transition-colors cursor-pointer">
                    <span>{limitWeeklyInfinite ? "∞" : `$${limitWeeklyValue.toFixed(2)}`}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" side="bottom" sideOffset={6} className="w-72 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">周消费上限 (USD)</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>无限</span>
                      <Switch checked={limitWeeklyInfinite} onCheckedChange={setLimitWeeklyInfinite} aria-label="无限" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={PROVIDER_LIMITS.LIMIT_WEEKLY_USD.MIN}
                      max={PROVIDER_LIMITS.LIMIT_WEEKLY_USD.MAX}
                      step={PROVIDER_LIMITS.LIMIT_WEEKLY_USD.STEP}
                      value={[limitWeeklyValue]}
                      onValueChange={(v) => !limitWeeklyInfinite && setLimitWeeklyValue(v?.[0] ?? PROVIDER_LIMITS.LIMIT_WEEKLY_USD.MIN)}
                      disabled={limitWeeklyInfinite}
                    />
                    <span className="w-16 text-right text-xs font-medium">{limitWeeklyInfinite ? "∞" : `$${limitWeeklyValue.toFixed(2)}`}</span>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="w-full text-center font-medium tabular-nums truncate text-foreground">
                <span>{limitWeeklyInfinite ? "∞" : `$${limitWeeklyValue.toFixed(2)}`}</span>
              </div>
            )}
          </div>

          {/* 月消费上限 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">Mon USD</div>
            {canEdit ? (
              <Popover open={showMonthlyLimit} onOpenChange={handleMonthlyLimitPopover}>
                <PopoverTrigger asChild>
                  <button type="button" className="w-full text-center font-medium tabular-nums truncate text-foreground hover:text-primary/80 transition-colors cursor-pointer">
                    <span>{limitMonthlyInfinite ? "∞" : `$${limitMonthlyValue.toFixed(2)}`}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" side="bottom" sideOffset={6} className="w-72 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">月消费上限 (USD)</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>无限</span>
                      <Switch checked={limitMonthlyInfinite} onCheckedChange={setLimitMonthlyInfinite} aria-label="无限" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={PROVIDER_LIMITS.LIMIT_MONTHLY_USD.MIN}
                      max={PROVIDER_LIMITS.LIMIT_MONTHLY_USD.MAX}
                      step={PROVIDER_LIMITS.LIMIT_MONTHLY_USD.STEP}
                      value={[limitMonthlyValue]}
                      onValueChange={(v) => !limitMonthlyInfinite && setLimitMonthlyValue(v?.[0] ?? PROVIDER_LIMITS.LIMIT_MONTHLY_USD.MIN)}
                      disabled={limitMonthlyInfinite}
                    />
                    <span className="w-16 text-right text-xs font-medium">{limitMonthlyInfinite ? "∞" : `$${limitMonthlyValue.toFixed(2)}`}</span>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="w-full text-center font-medium tabular-nums truncate text-foreground">
                <span>{limitMonthlyInfinite ? "∞" : `$${limitMonthlyValue.toFixed(2)}`}</span>
              </div>
            )}
          </div>

          {/* 并发Session上限 */}
          <div className="min-w-0 text-center">
            <div className="text-muted-foreground">并发</div>
            {canEdit ? (
              <Popover open={showConcurrent} onOpenChange={handleConcurrentPopover}>
                <PopoverTrigger asChild>
                  <button type="button" className="w-full text-center font-medium tabular-nums truncate text-foreground hover:text-primary/80 transition-colors cursor-pointer">
                    <span>{concurrentInfinite ? "∞" : concurrentValue.toLocaleString()}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" side="bottom" sideOffset={6} className="w-72 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">并发Session上限</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>无限</span>
                      <Switch checked={concurrentInfinite} onCheckedChange={setConcurrentInfinite} aria-label="无限" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={PROVIDER_LIMITS.CONCURRENT_SESSIONS.MIN}
                      max={PROVIDER_LIMITS.CONCURRENT_SESSIONS.MAX}
                      step={1}
                      value={[concurrentValue]}
                      onValueChange={(v) => !concurrentInfinite && setConcurrentValue(v?.[0] ?? PROVIDER_LIMITS.CONCURRENT_SESSIONS.MIN)}
                      disabled={concurrentInfinite}
                    />
                    <span className="w-16 text-right text-xs font-medium">{concurrentInfinite ? "∞" : concurrentValue.toLocaleString()}</span>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="w-full text-center font-medium tabular-nums truncate text-foreground">
                <span>{concurrentInfinite ? "∞" : concurrentValue.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/60">
        <span>创建 {item.createdAt}</span>
        <span>更新 {item.updatedAt}</span>
      </div>
    </div>
  );
}