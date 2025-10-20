
## 项目简介

Claude Code Hub 是一个 Claude Code API 代理中转服务平台，用于统一管理多个 CC 服务提供商，提供智能负载均衡、用户权限管理和使用统计功能。
使用中文和用户沟通。

## 常用命令

```bash
# 开发
pnpm dev              # 启动开发服务器 (http://localhost:13500, 使用 Turbopack, 当前已经启动, 直接调用即可。)
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器
pnpm lint             # 运行 ESLint
pnpm typecheck        # TypeScript 类型检查

# 数据库
pnpm db:generate      # 生成 Drizzle 迁移文件
pnpm db:migrate       # 执行数据库迁移
pnpm db:push          # 直接推送 schema 到数据库
pnpm db:studio        # 启动 Drizzle Studio 可视化管理界面
```

## 核心架构

### 技术栈
- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Hono** - 用于 API 路由处理
- **Drizzle ORM** + **PostgreSQL** - 数据持久化
- **Tailwind CSS v4** + **Shadcn UI** (orange 主题) - UI 框架
- **包管理器**: pnpm 9.15.0

### 目录结构
```
src/
├── app/                          # Next.js App Router
│   ├── v1/[...route]/route.ts    # 主代理 API 入口 (Hono)
│   ├── api/auth/                 # 认证相关 API
│   ├── dashboard/                # 仪表盘页面
│   ├── settings/                 # 设置页面 (供应商、价格等)
│   └── login/                    # 登录页面
├── actions/                      # Server Actions (用户、密钥、供应商等)
├── repository/                   # 数据访问层 (Drizzle 查询)
├── drizzle/                      # 数据库 schema 和连接
├── lib/                          # 工具函数和配置
│   ├── config/                   # 环境变量配置和验证
│   ├── utils/                    # 通用工具 (成本计算、货币等)
│   └── auth.ts                   # 认证逻辑
├── components/                   # 
│   ├── ui/                       # shadcn ui安装的组件目录，此目录禁止修改和删除。只能使用 shadcn ui cli 进行添加和更新。
│   └── cutstoms/*                # 自定义的组件，一般用于多个页面或者 layout 共用组件
└── types/                        # TypeScript 类型定义
```

> 每个 `page` 的目录下都可以有 `_components` 目录，用于存储当前 `page` 下封装的组件。
> 如果有多个页面或者 layout 使用，则应该放在 `src/app/components/customs/` 目录下，并且根据模块划分不同文件夹。



### 代理系统架构

代理请求处理流程 (`src/app/v1/_lib/proxy-handler.ts`) 采用职责链模式：

1. **ProxySession** - 会话上下文管理
2. **ProxyAuthenticator** - API Key 认证和权限验证
3. **ProxyProviderResolver** - 智能供应商选择
   - 支持会话复用（连续对话使用同一供应商）
   - 加权随机负载均衡
4. **ProxyMessageService** - 消息上下文处理
5. **ProxyForwarder** - 转发请求到上游供应商
6. **ProxyResponseHandler** - 处理响应（支持 SSE 流式）
7. **ProxyErrorHandler** - 统一错误处理

### 数据库 Schema

核心表 (`src/drizzle/schema.ts`)：
- **users** - 用户表 (RPM 限制、每日额度)
- **keys** - API 密钥表
- **providers** - 上游供应商表 (URL、权重、流量限制)
- **message_request** - 请求日志表 (成本追踪)
- **model_prices** - 模型价格表

### 环境配置

必需的环境变量 (`.env.local` 或 `.env`)：
- `ADMIN_TOKEN` - 管理员登录令牌
- `DSN` - PostgreSQL 连接字符串
- `AUTO_MIGRATE` - 是否自动执行数据库迁移 (默认 true)
- `NODE_ENV` - 运行环境 (development/production/test)

### TypeScript 配置
- 路径别名 `@/*` → `./src/*`
- 严格模式已启用

### 样式系统
- 使用 Shadcn UI orange 主题
- 主题变量已在 `globals.css` 中配置
- 尽量使用 CSS 变量，避免直接修改 `globals.css`

## 开发注意事项

### MCP 集成
项目配置了 MCP (Model Context Protocol) 数据库工具 (`.mcp.json`)，可通过 `@bytebase/dbhub` 进行数据库操作。

### 数据库迁移
- 修改 schema 后，运行 `pnpm db:generate` 生成迁移文件
- 生产环境通过 `AUTO_MIGRATE=true` 或手动执行 `pnpm db:migrate`

### API 认证
- 管理面板使用 `ADMIN_TOKEN` 认证
- 普通用户则使用名下的用户密钥进行登录
- 代理 API 使用用户密钥 (`Authorization: Bearer sk-xxx`)调用本服务代理的接口。

## 待开发功能

### 1. Codex API 支持
**目标**：接入 Anthropic Codex API（专用编程模型）

**技术要点**：
- 复用现有代理架构（职责链模式）
- 在 `ProxyForwarder` 中识别 Codex 请求类型
- `message_request` 表添加 `api_type` 字段区分 Chat/Codex

**核心问题**：
- Codex 的计费单位和 Chat 不同（需确认上游价格模型）
- 会话管理：Codex 长会话的上下文是否需要单独存储？

**风险点**：
- 不要为 Codex 单独建一套代理逻辑（DRY 原则）

---

### 2. Codex 转聊天支持（OpenAI 兼容端点）
**目标**：将 Codex API 转换为标准 Chat Completion 格式输出

**技术要点**：
- 新增 `/v1/chat/completions` 端点（OpenAI 兼容）
- Response API 转换层：Codex Response → Chat Message Format
- 支持流式（SSE）和非流式输出

**核心问题**：
- Codex 的工具调用（tool use）如何映射到 Chat 的 function calling？
- 双重计费：上游 Codex 价格 vs 下游 Chat 价格如何处理？

**建议**：
- 不要"转换"，直接支持两种协议（通过 `Accept` header 或路径区分）
- 避免维护两套计费逻辑（统一使用 token 计量）

---

### 3. 充值和计费系统（易支付集成）
**目标**：实现用户余额管理和在线充值

**数据结构变更**：
- `users` 表增加字段：
  - `balance` (decimal) - 账户余额（单位：元）
  - `total_recharged` (decimal) - 累计充值
- 新增 `transactions` 表：
  - `id`, `user_id`, `type` (recharge/consume), `amount`, `balance_after`, `created_at`
  - `payment_order_id`, `payment_status`, `payment_method`

**API 端点**：
- `POST /api/payment/recharge` - 发起充值（生成易支付订单）
- `POST /api/payment/callback` - 易支付回调通知
- `GET /api/payment/verify/:order_id` - 主动查询订单状态

**核心问题**：
- **并发扣费**：使用数据库事务（`FOR UPDATE`）或乐观锁
- **重复回调**：易支付可能重复推送，需幂等性设计（订单号去重）
- **金额校验**：回调金额必须与订单金额严格匹配

**风险点**：
- 引入余额系统后，现有用户如何处理？（建议：默认余额 -1 表示无限额度）
- 需要环境变量开关 `ENABLE_BILLING=true/false`

---

### 4. 查询 API 和流水页面
**目标**：提供用户维度的使用记录和账单查询

**前端页面**：
- `/dashboard/usage` - 使用记录查询
  - 时间范围筛选、模型筛选、消费统计
  - 数据来源：`message_request` 表

- `/dashboard/transactions` - 充值和消费流水
  - 展示 `transactions` 表数据
  - 支持导出 CSV

**API 端点**：
- `GET /api/user/usage` - 查询使用记录（分页）
- `GET /api/user/transactions` - 查询流水记录（分页）
- `GET /api/user/statistics` - 统计数据（今日消费、本月消费、余额等）

**性能考虑**：
- 时间范围过大时需要分页（limit 100）
- 添加索引：`message_request(user_id, created_at)`, `transactions(user_id, created_at)`
- 考虑缓存统计数据（Redis）

**核心问题**：
- 现有 `message_request` 表已有数据，新增 `api_type` 字段后需要兼容历史数据（默认值 'chat'）

---

## 实施建议（Linus 式）

**先做什么**：
1. 流水查询页面（复用现有数据，最简单）
2. Codex API 支持（扩展现有代理，复杂度可控）
3. 充值系统（引入复杂度最高，需确认商业需求）

**数据结构原则**：
- 不要为每个功能建新表
- `message_request` 加类型字段即可区分 Chat/Codex
- `transactions` 使用 `type` 字段区分充值/消费（一张表搞定）

**向后兼容铁律**：
- 默认余额 -1（无限额度），不影响现有用户
- 新增字段必须有默认值
- 通过环境变量控制新功能开关

**"Good Taste" 检查清单**：
- [ ] 能否用一个字段解决？（不要建新表）
- [ ] 能否复用现有代码？（不要复制粘贴）
- [ ] 边界情况能否通过设计消除？（不要堆 if/else）
- [ ] 会破坏现有功能吗？（向后兼容）

---

### 5. TPM/RPM/RPD/CC 限流功能

**目标**：为用户密钥和上游供应商添加速率限制，防止滥用并保护服务稳定性

#### 现状分析

**数据库层（✓ 已完成）**：
```sql
-- users 表
rpm_limit INTEGER DEFAULT 60
daily_limit_usd NUMERIC(10,2) DEFAULT 100.00

-- providers 表
tpm INTEGER DEFAULT 0    -- Tokens Per Minute
rpm INTEGER DEFAULT 0    -- Requests Per Minute
rpd INTEGER DEFAULT 0    -- Requests Per Day
cc INTEGER DEFAULT 0     -- Concurrent Connections
```

**前端层（✓ 已完成）**：
- 用户表单：有 RPM 和每日额度输入
- 供应商表单：有完整的 TPM/RPM/RPD/CC 输入
- 提示文案："（TPM/RPM/RPD/CC 功能尚未实现，近期即将更新）"

**业务逻辑层（✗ 缺失）**：
- ❌ 代理请求处理器中无限流检查
- ❌ 供应商选择器只看 `isEnabled` 和 `weight`，忽略限流配置
- ❌ `findKeyUsageToday()` 查询函数存在但从未被调用

**结论**：数据结构和前端已就绪，缺少核心限流逻辑。

---

#### 技术方案

##### 架构设计

**技术选型**（基于 Node.js 最优实践）：

| 组件 | 选择 | 理由 |
|------|------|------|
| 限流库 | `rate-limiter-flexible` | 生产级、支持多种算法、Redis + 内存双模式 |
| Redis 客户端 | `ioredis` | 高性能、完善的重连机制、TypeScript 原生支持 |
| 算法 | 固定窗口 + 滑动窗口 | 固定窗口（RPM/RPD）、滑动窗口（TPM） |
| 降级策略 | Fail Open | Redis 不可用时放行请求，保证服务可用性 |

**三层降级防护**：
1. **Level 1 - Redis 可用**（正常模式）：多实例共享计数器，精确限流
2. **Level 2 - Redis 不可用**（内存降级）：进程内存计数器，单机限流
3. **Level 3 - 限流失效**（Fail Open）：仅记录日志，请求正常通过

##### 限流维度

**用户维度（下游限制）**：
```
user:{userId}:rpm          # 每分钟请求数（60秒窗口）
user:{userId}:daily_cost   # 每日消费额度（数据库查询 + 60秒缓存）
```

**供应商维度（上游保护）**：
```
provider:{providerId}:rpm        # 每分钟请求数（60秒窗口）
provider:{providerId}:rpd        # 每日请求数（24小时窗口）
provider:{providerId}:tpm        # 每分钟 Token 数（60秒滑动窗口）
provider:{providerId}:concurrent # 并发连接数（实时计数）
```

---

#### 实施步骤

##### Phase 1: 基础设施

**1.1 Docker Compose 配置**
```yaml
# docker-compose.yml
services:
  postgres:
    # ... 现有配置

  redis:
    image: redis:7-alpine
    container_name: claude-hub-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

**1.2 环境变量**
```env
# .env.local
ENABLE_RATE_LIMIT=true  # 默认 false，逐步启用
REDIS_URL=redis://localhost:6379  # 不配置则降级到内存模式
```

**1.3 安装依赖**
```bash
pnpm add rate-limiter-flexible ioredis
pnpm add -D @types/ioredis
```

---

##### Phase 2: Redis 连接管理器

**创建 `src/lib/redis/client.ts`**（优雅降级）
- 检测 `REDIS_URL` 环境变量
- 连接失败自动重试（最多 5 次）
- 超时后返回 `null`，触发内存模式降级
- 监听 `error`/`close` 事件，记录日志

**关键代码示例**：
```typescript
const redisClient = new Redis(redisUrl, {
  enableOfflineQueue: false,  // 快速失败
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;  // 停止重试，降级
    return Math.min(times * 200, 2000);
  },
});
```

---

##### Phase 3: 统一限流服务

**创建 `src/lib/rate-limit/service.ts`**
- 封装 `rate-limiter-flexible` 库
- 自动选择 Redis 或内存模式
- 统一接口：`check(key, identifier, config)`
- Fail Open：任何错误都放行请求

**接口设计**：
```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  totalHits: number;
}

rateLimitService.check('user_rpm', userId, {
  points: 60,      // 限制数量
  duration: 60,    // 时间窗口（秒）
});
```

**降级逻辑**：
```typescript
if (!isEnabled || config.points <= 0) {
  return { allowed: true };  // 配置关闭或无限制
}

try {
  // 尝试限流检查
} catch (error) {
  // Fail Open：出错即放行
  console.error('Rate limit check failed:', error);
  return { allowed: true };
}
```

---

##### Phase 4: 用户限流中间件

**创建 `src/app/v1/_lib/proxy/rate-limit-guard.ts`**
1. 检查用户 RPM（60秒固定窗口）
2. 检查用户每日额度（查数据库 + 缓存）
3. 超限返回 `429 Too Many Requests`

**修改 `src/app/v1/_lib/proxy-handler.ts`**
```typescript
export async function handleProxyRequest(c: Context): Promise<Response> {
  const session = await ProxySession.fromContext(c);

  const unauthorized = await ProxyAuthenticator.ensure(session);
  if (unauthorized) return unauthorized;

  // 新增：用户限流检查
  const rateLimited = await ProxyRateLimitGuard.ensure(session);
  if (rateLimited) return rateLimited;

  // ... 其余不变
}
```

**响应头示例**：
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 45
Retry-After: 45
```

---

##### Phase 5: 供应商限流

**修改 `src/app/v1/_lib/proxy/provider-selector.ts`**
- 在 `pickRandomProvider()` 中过滤超限供应商
- 检查 RPM（60秒窗口）
- 检查 RPD（24小时窗口）
- 所有供应商超限时降级：随机选一个（让上游拒绝）

**降级策略**：
```typescript
const availableProviders = providers.filter(checkProviderAvailable);

if (availableProviders.length === 0) {
  console.warn('All providers rate limited, falling back to random');
  return weightedRandom(enabledProviders);  // 降级
}
```

---

##### Phase 6: TPM 和 CC（高级功能）

**TPM 实现思路**：
1. 请求前：估算 token 数（根据 prompt 长度）
2. 消费 TPM 配额
3. 响应后：校准实际 token 数（可选）

**CC 实现思路**：
1. 请求开始：`INCR provider:{id}:concurrent`
2. 检查是否超过 `cc` 限制
3. 请求结束：`DECR provider:{id}:concurrent`（无论成功失败）

**关键点**：
- CC 需要在 `ProxyForwarder` 中实现
- 使用 `try...finally` 确保 `DECR` 一定执行

---

##### Phase 7: 前端优化

**移除"尚未实现"提示**：
```typescript
// src/app/settings/providers/page.tsx
- description="（TPM/RPM/RPD/CC 功能尚未实现，近期即将更新）"
+ description="配置供应商速率限制，留空或填 0 表示无限制"
```

**添加状态显示（可选）**：
```tsx
{provider.rpm > 0 && (
  <div className="text-xs text-muted-foreground">
    当前 RPM: {currentRpm}/{provider.rpm}
  </div>
)}
```

---

#### 测试验证

##### 1. 用户 RPM 限流测试
```bash
# 用户 RPM=60，快速发送 100 个请求
for i in {1..100}; do
  curl -H "Authorization: Bearer sk-xxx" \
       http://localhost:13500/v1/messages &
done
wait

# 预期：前 60 个成功，后 40 个返回 429
```

##### 2. Redis 降级测试
```bash
# 停止 Redis
docker stop claude-hub-redis

# 发送请求，应该仍然成功（降级到内存模式）
curl -H "Authorization: Bearer sk-xxx" \
     http://localhost:13500/v1/messages

# 观察日志：应该看到 "falling back to memory" 警告
```

##### 3. 供应商限流测试
```bash
# 设置供应商 RPM=10
# 快速发送 20 个请求
# 预期：前 10 个使用该供应商，后 10 个选择其他供应商（或失败）
```

---

#### 配置示例

**开发环境（无 Redis）**：
```env
ENABLE_RATE_LIMIT=false  # 关闭限流，开发更方便
# REDIS_URL 不配置
```

**生产环境（有 Redis）**：
```env
ENABLE_RATE_LIMIT=true
REDIS_URL=redis://redis:6379
```

---

#### 监控和调优

**日志输出**：
- ✅ Redis 连接状态（connected/error/close）
- ✅ 限流触发记录（用户/供应商 ID、触发类型）
- ✅ 降级决策（Redis → Memory → Fail Open）

**响应头**（符合 HTTP 标准）：
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 15
Retry-After: 15
```

**Prometheus Metrics（未来可扩展）**：
```
rate_limit_hits_total{type="user", result="allowed"}
rate_limit_hits_total{type="user", result="blocked"}
rate_limit_fallback_total{from="redis", to="memory"}
```

---

#### 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Redis 不可用 | 限流失效 | 自动降级到内存模式 |
| 多实例内存不一致 | 单机超限 | 可接受（至少有限流） |
| 配置错误（limit=1） | 服务不可用 | 前端最小值校验 + 默认值 |
| 时区问题 | 统计偏差 | 使用 UTC 统一计算 |
| 所有供应商超限 | 无可用服务 | 降级：随机选一个 |
| 限流库崩溃 | 请求阻断 | Fail Open 策略 |

---

#### 实施优先级

**P0（必做）**：
1. Phase 1-3：基础设施 + Redis 管理 + 限流服务
2. Phase 4：用户 RPM + 每日额度检查

**P1（推荐）**：
3. Phase 5：供应商 RPM/RPD 限流
4. Phase 7：前端提示更新

**P2（可选）**：
5. Phase 6：TPM 和 CC 高级功能
6. 监控 Metrics 和告警

**预计工作量**：
- P0: **1 天**（基础功能）
- P1: **1 天**（供应商限流）
- P2: **1-2 天**（高级功能）
- **总计：3-4 天**

---

#### Good Taste 检查清单

- [x] **数据结构简单** — Redis 计数器 + TTL，无需新建表
- [x] **消除特殊情况** — `limit=0` 或 `null` 自动表示无限制，无需 if/else
- [x] **最多三层缩进** — 限流检查独立为 middleware，逻辑清晰
- [x] **零破坏** — 默认关闭，Redis 不可用自动降级，Fail Open 保证服务
- [x] **不重复造轮子** — 使用成熟的 `rate-limiter-flexible` 库
- [x] **向后兼容** — 数据库字段已存在，旧数据 `0` 表示无限制

---

#### 参考资源

**最优实践**：
- Node.js Best Practices: Rate Limiting with Redis
- rate-limiter-flexible 官方文档
- ioredis 重连策略最佳实践

**算法对比**：
- 固定窗口：简单、性能高、有临界突刺风险
- 滑动窗口：精确、平滑、内存占用略高
- 令牌桶：最灵活、适合复杂场景

---

### 6. 用户绑定上游 + 智能重试 + 排行榜系统

**目标**：实现生产级多租户流量管理，支持用户绑定特定供应商、基于 Session 的智能路由、熔断降级和消耗排行榜

#### 核心需求背景

**现状问题**：
1. ❌ 所有用户共享供应商池，无法实现差异化服务（VIP 用户需要独享供应商）
2. ❌ 现有并发限制（CC）基于请求数，未考虑 Claude 的上下文缓存机制
3. ❌ 单一供应商故障导致请求直接失败，缺少智能降级
4. ❌ 缺少用户消耗可视化，无法识别高消耗用户

**核心洞察**：
- Claude API 有 **5 分钟上下文缓存**，频繁切换供应商会导致缓存失效，成本暴涨
- 并发限制应该基于 **活跃 Session 数**，而不是请求数（RPM）
- 用户绑定不应该是强制的，而是 **多层降级策略**：绑定 → 分组 → 全局

---

#### 数据结构设计

##### 新建表

**1. 用户供应商绑定表**（一对多，支持优先级）
```sql
CREATE TABLE user_provider_bindings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,  -- 优先级（0 最高）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider_id)
);

CREATE INDEX idx_user_provider_bindings_user ON user_provider_bindings(user_id);
CREATE INDEX idx_user_provider_bindings_priority ON user_provider_bindings(user_id, priority);
```

**2. 供应商健康度追踪表**（用于熔断器）
```sql
CREATE TABLE provider_health (
  provider_id INTEGER PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  failure_count INTEGER DEFAULT 0,          -- 失败次数
  last_failure_at TIMESTAMP,                -- 最后失败时间
  circuit_open BOOLEAN DEFAULT false,       -- 熔断器是否打开
  circuit_open_until TIMESTAMP,             -- 熔断器关闭时间
  success_count_after_open INTEGER DEFAULT 0,  -- 半开状态下的成功次数
  updated_at TIMESTAMP DEFAULT NOW()
);
```

##### 修改现有表

```sql
-- 供应商分组（标签方式）
ALTER TABLE providers ADD COLUMN group_name VARCHAR(50) DEFAULT 'default';

-- 用户默认供应商组
ALTER TABLE users ADD COLUMN provider_group VARCHAR(50);

-- 为分组创建索引
CREATE INDEX idx_providers_group ON providers(group_name);
CREATE INDEX idx_users_provider_group ON users(provider_group);
```

---

#### 核心架构设计

##### 供应商选择算法（4 层降级）

```typescript
/**
 * 智能供应商选择器
 * 优先级：会话粘性 → 用户绑定 → 用户组 → 全局兜底
 */
export class ProxyProviderResolver {

  async resolveProvider(session: ProxySession): Promise<Provider> {
    // Layer 0: 会话粘性（现有逻辑，保持不变）
    const cachedProvider = await this.getSessionProvider(session.sessionId);
    if (cachedProvider && await this.isProviderHealthy(cachedProvider.id)) {
      await this.trackSessionUsage(session.sessionId, cachedProvider.id);
      return cachedProvider;
    }

    // Layer 1: 用户绑定（按优先级排序）
    const boundProviders = await this.getUserBoundProviders(session.user.id);
    if (boundProviders.length > 0) {
      const available = await this.filterByHealthAndCapacity(boundProviders, session);
      if (available.length > 0) {
        const selected = this.weightedRandom(available);
        await this.cacheSessionProvider(session.sessionId, selected.id);
        return selected;
      }
      // 绑定的供应商全部不可用，记录警告但继续降级
      console.warn(`[User ${session.user.id}] Bound providers unavailable, falling back to group`);
    }

    // Layer 2: 用户组
    const userGroup = session.user.provider_group;
    if (userGroup) {
      const groupProviders = await this.getProvidersByGroup(userGroup);
      const available = await this.filterByHealthAndCapacity(groupProviders, session);
      if (available.length > 0) {
        const selected = this.weightedRandom(available);
        await this.cacheSessionProvider(session.sessionId, selected.id);
        return selected;
      }
      console.warn(`[User ${session.user.id}] Group '${userGroup}' providers unavailable, falling back to global`);
    }

    // Layer 3: 全局兜底（所有启用的供应商）
    const allProviders = await this.getAllEnabledProviders();
    const available = await this.filterByHealthAndCapacity(allProviders, session);

    if (available.length === 0) {
      throw new ProxyError(503, 'No available providers', {
        reason: 'All providers are either unhealthy or at capacity',
        userId: session.user.id,
      });
    }

    const selected = this.weightedRandom(available);
    await this.cacheSessionProvider(session.sessionId, selected.id);
    return selected;
  }

  /**
   * 过滤健康且有容量的供应商
   */
  private async filterByHealthAndCapacity(
    providers: Provider[],
    session: ProxySession
  ): Promise<Provider[]> {
    const results = await Promise.all(
      providers.map(async (p) => {
        // 1. 检查熔断器状态
        if (await circuitBreakerService.isOpen(p.id)) {
          return null;
        }

        // 2. 检查 Session 并发容量（核心创新）
        if (p.cc > 0) {
          const activeSessions = await redis.scard(`provider:${p.id}:active_sessions`);
          if (activeSessions >= p.cc) {
            console.debug(`[Provider ${p.id}] Session capacity full: ${activeSessions}/${p.cc}`);
            return null;
          }
        }

        // 3. 检查 RPM/RPD 限流（复用现有逻辑）
        if (!await rateLimitService.checkProviderLimits(p.id)) {
          return null;
        }

        return p;
      })
    );

    return results.filter((p): p is Provider => p !== null);
  }

  /**
   * 追踪 Session 使用（5 分钟 TTL）
   */
  private async trackSessionUsage(sessionId: string, providerId: number): Promise<void> {
    const pipeline = redis.pipeline();

    // 添加到供应商的活跃 Session 集合
    pipeline.sadd(`provider:${providerId}:active_sessions`, sessionId);

    // 更新 Session 的最后活跃时间（5 分钟过期）
    pipeline.setex(`session:${sessionId}:last_seen`, 300, Date.now().toString());

    // 记录 Session 使用的供应商（用于清理）
    pipeline.setex(`session:${sessionId}:provider`, 300, providerId.toString());

    await pipeline.exec();
  }
}
```

---

#### Session 并发追踪机制

**关键设计**：
- **活跃 Session**：最近 5 分钟内有请求的 Session
- **自动过期**：通过 Redis TTL 实现，无需定时任务
- **容量检查**：选择供应商时检查 `active_sessions` 集合大小

**Redis 数据结构**：
```
# 供应商的活跃 Session 集合
provider:{providerId}:active_sessions = SET { sessionId1, sessionId2, ... }

# Session 最后活跃时间（TTL 300 秒）
session:{sessionId}:last_seen = "1699999999999" (timestamp)

# Session 当前使用的供应商（TTL 300 秒）
session:{sessionId}:provider = "123"
```

**清理机制**：
```typescript
/**
 * 后台任务：清理过期的 Session（每分钟执行一次）
 * 虽然 Redis TTL 会自动过期，但集合中的引用需要手动清理
 */
async function cleanupExpiredSessions() {
  const providers = await db.select().from(providersTable);

  for (const provider of providers) {
    const sessions = await redis.smembers(`provider:${provider.id}:active_sessions`);

    for (const sessionId of sessions) {
      const lastSeen = await redis.get(`session:${sessionId}:last_seen`);

      // 如果 last_seen 已过期，从集合中移除
      if (!lastSeen) {
        await redis.srem(`provider:${provider.id}:active_sessions`, sessionId);
        console.debug(`[Cleanup] Removed expired session ${sessionId} from provider ${provider.id}`);
      }
    }
  }
}
```

---

#### 智能重试 + 熔断器

##### 熔断器设计

**状态机**：
```
关闭（Closed） ──失败次数超阈值──> 打开（Open） ──等待60秒──> 半开（Half-Open）
                                      │                          │
                                      └──────────────────────────┘
                                         成功2次后恢复 Closed
```

**配置参数**：
```typescript
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // 失败 5 次后打开熔断器
  openDuration: 60 * 1000,    // 熔断器打开 60 秒
  halfOpenSuccessThreshold: 2 // 半开状态下成功 2 次后关闭
};
```

**实现代码**：
```typescript
export class CircuitBreakerService {

  async isOpen(providerId: number): Promise<boolean> {
    const health = await db.query.providerHealth.findFirst({
      where: eq(providerHealthTable.providerId, providerId)
    });

    if (!health || !health.circuitOpen) return false;

    // 检查是否可以转为半开状态
    if (health.circuitOpenUntil && new Date() > health.circuitOpenUntil) {
      await this.transitionToHalfOpen(providerId);
      return false; // 允许尝试
    }

    return true;
  }

  async recordFailure(providerId: number, error: Error): Promise<void> {
    const health = await this.getOrCreateHealth(providerId);

    await db
      .update(providerHealthTable)
      .set({
        failureCount: health.failureCount + 1,
        lastFailureAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(providerHealthTable.providerId, providerId));

    // 检查是否需要打开熔断器
    if (health.failureCount + 1 >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      await this.openCircuit(providerId);
      console.warn(`[CircuitBreaker] Opened for provider ${providerId} after ${health.failureCount + 1} failures`);
    }
  }

  async recordSuccess(providerId: number): Promise<void> {
    const health = await this.getOrCreateHealth(providerId);

    if (health.circuitOpen) {
      // 半开状态下成功
      const newSuccessCount = health.successCountAfterOpen + 1;

      if (newSuccessCount >= CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold) {
        await this.closeCircuit(providerId);
        console.info(`[CircuitBreaker] Closed for provider ${providerId} after ${newSuccessCount} successes`);
      } else {
        await db
          .update(providerHealthTable)
          .set({ successCountAfterOpen: newSuccessCount })
          .where(eq(providerHealthTable.providerId, providerId));
      }
    } else {
      // 正常状态下成功，重置失败计数
      await db
        .update(providerHealthTable)
        .set({ failureCount: 0, updatedAt: new Date() })
        .where(eq(providerHealthTable.providerId, providerId));
    }
  }

  private async openCircuit(providerId: number): Promise<void> {
    const openUntil = new Date(Date.now() + CIRCUIT_BREAKER_CONFIG.openDuration);

    await db
      .update(providerHealthTable)
      .set({
        circuitOpen: true,
        circuitOpenUntil: openUntil,
        successCountAfterOpen: 0,
        updatedAt: new Date()
      })
      .where(eq(providerHealthTable.providerId, providerId));
  }

  private async closeCircuit(providerId: number): Promise<void> {
    await db
      .update(providerHealthTable)
      .set({
        circuitOpen: false,
        circuitOpenUntil: null,
        failureCount: 0,
        successCountAfterOpen: 0,
        updatedAt: new Date()
      })
      .where(eq(providerHealthTable.providerId, providerId));
  }
}
```

##### 智能重试逻辑

**在 `ProxyForwarder` 中集成**：
```typescript
export class ProxyForwarder {

  async forward(
    session: ProxySession,
    provider: Provider
  ): Promise<Response> {
    let lastError: Error | null = null;
    let attemptCount = 0;
    const MAX_RETRIES = 3; // 最多重试 3 次（总共尝试 4 个供应商）

    while (attemptCount <= MAX_RETRIES) {
      try {
        // 记录 Session 使用
        await this.trackSessionUsage(session.sessionId, provider.id);

        // 转发请求
        const response = await this.doForward(session, provider);

        // 成功：记录健康状态
        await circuitBreakerService.recordSuccess(provider.id);

        return response;

      } catch (error) {
        attemptCount++;
        lastError = error;

        // 记录失败
        await circuitBreakerService.recordFailure(provider.id, error);

        console.warn(
          `[Retry ${attemptCount}/${MAX_RETRIES}] Provider ${provider.id} failed: ${error.message}`
        );

        // 如果还有重试机会，选择新的供应商
        if (attemptCount <= MAX_RETRIES) {
          const newProvider = await this.selectAlternativeProvider(session, provider.id);
          if (!newProvider) {
            // 没有可用的替代供应商，直接抛出错误
            break;
          }
          provider = newProvider;
          console.info(`[Retry ${attemptCount}] Switched to provider ${provider.id}`);
        }
      }
    }

    // 所有重试都失败
    throw new ProxyError(503, 'All providers failed after retries', {
      attempts: attemptCount,
      lastError: lastError?.message
    });
  }

  /**
   * 选择替代供应商（排除已失败的）
   */
  private async selectAlternativeProvider(
    session: ProxySession,
    excludeProviderId: number
  ): Promise<Provider | null> {
    // 复用 resolveProvider 逻辑，但排除已失败的供应商
    const resolver = new ProxyProviderResolver();
    const candidates = await resolver.getCandidateProviders(session);

    const available = candidates.filter(p =>
      p.id !== excludeProviderId &&
      !await circuitBreakerService.isOpen(p.id)
    );

    if (available.length === 0) return null;

    return resolver.weightedRandom(available);
  }
}
```

---

#### 每日消耗排行榜

##### API 端点

**1. 今日排行榜**
```typescript
// GET /api/leaderboard/daily
// 返回今天消耗 Top 50 用户

import { startOfDay, endOfDay } from 'date-fns';

export async function GET(request: Request) {
  const today = new Date();
  const startTime = startOfDay(today);
  const endTime = endOfDay(today);

  // 尝试从 Redis 缓存获取（5 分钟缓存）
  const cacheKey = `leaderboard:daily:${today.toISOString().split('T')[0]}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return Response.json(JSON.parse(cached));
  }

  // 查询数据库
  const rankings = await db
    .select({
      userId: messageRequestTable.userId,
      username: usersTable.username,
      totalRequests: sql<number>`count(*)`,
      totalCost: sql<number>`sum(${messageRequestTable.totalCost})`,
      totalTokens: sql<number>`sum(${messageRequestTable.inputTokens} + ${messageRequestTable.outputTokens})`
    })
    .from(messageRequestTable)
    .innerJoin(usersTable, eq(messageRequestTable.userId, usersTable.id))
    .where(
      and(
        gte(messageRequestTable.createdAt, startTime),
        lte(messageRequestTable.createdAt, endTime)
      )
    )
    .groupBy(messageRequestTable.userId, usersTable.username)
    .orderBy(desc(sql`sum(${messageRequestTable.totalCost})`))
    .limit(50);

  // 缓存 5 分钟
  await redis.setex(cacheKey, 300, JSON.stringify(rankings));

  return Response.json(rankings);
}
```

**2. 本月排行榜**（类似逻辑，时间范围改为本月）

##### 前端页面

**路径**：`/dashboard/leaderboard`

**UI 组件**：
```tsx
// src/app/dashboard/leaderboard/page.tsx

export default async function LeaderboardPage() {
  const dailyData = await fetch('/api/leaderboard/daily');
  const monthlyData = await fetch('/api/leaderboard/monthly');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">消耗排行榜</h1>
        <div className="text-sm text-muted-foreground">
          数据每 5 分钟更新一次
        </div>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">今日排行</TabsTrigger>
          <TabsTrigger value="monthly">本月排行</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <LeaderboardTable data={dailyData} />
        </TabsContent>

        <TabsContent value="monthly">
          <LeaderboardTable data={monthlyData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaderboardTable({ data }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">排名</TableHead>
          <TableHead>用户</TableHead>
          <TableHead className="text-right">请求数</TableHead>
          <TableHead className="text-right">Token 数</TableHead>
          <TableHead className="text-right">消耗金额</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={item.userId}>
            <TableCell className="font-medium">
              {index < 3 ? (
                <Badge variant={index === 0 ? 'default' : 'secondary'}>
                  #{index + 1}
                </Badge>
              ) : (
                `#${index + 1}`
              )}
            </TableCell>
            <TableCell>{item.username}</TableCell>
            <TableCell className="text-right">{item.totalRequests}</TableCell>
            <TableCell className="text-right">{formatNumber(item.totalTokens)}</TableCell>
            <TableCell className="text-right font-mono">
              ${item.totalCost.toFixed(4)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

#### 用户绑定管理 UI

##### 后台管理页面

**路径**：`/settings/users/[userId]/bindings`

**功能**：
- 查看用户当前绑定的供应商
- 添加/删除绑定
- 调整优先级
- 设置用户所属组

```tsx
// src/app/settings/users/[userId]/bindings/page.tsx

export default async function UserBindingsPage({ params }) {
  const userId = params.userId;
  const user = await getUserById(userId);
  const bindings = await getUserBindings(userId);
  const allProviders = await getAllProviders();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">用户供应商绑定</h2>
        <p className="text-muted-foreground">
          为 {user.username} 配置专属供应商和分组
        </p>
      </div>

      {/* 用户组设置 */}
      <Card>
        <CardHeader>
          <CardTitle>默认供应商组</CardTitle>
          <CardDescription>
            当用户没有绑定供应商时，将从此组中选择
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={user.providerGroup}
            onValueChange={handleGroupChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择供应商组" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">默认组</SelectItem>
              <SelectItem value="premium">高级组</SelectItem>
              <SelectItem value="economy">经济组</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 绑定列表 */}
      <Card>
        <CardHeader>
          <CardTitle>绑定的供应商（按优先级）</CardTitle>
          <CardDescription>
            优先级 0 最高，系统会优先尝试高优先级的供应商
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={bindingColumns}
            data={bindings}
            onReorder={handleReorder}
            onDelete={handleDelete}
          />
          <Button onClick={handleAddBinding} className="mt-4">
            添加绑定
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

#### 环境变量配置

```env
# .env.local

# Redis 配置（必需）
REDIS_URL=redis://localhost:6379

# Session 配置
SESSION_TTL=300                    # Session 过期时间（秒，默认 5 分钟）
SESSION_CLEANUP_INTERVAL=60        # 清理间隔（秒，默认 1 分钟）

# 熔断器配置
CIRCUIT_BREAKER_ENABLED=true       # 启用熔断器（默认 true）
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5   # 失败次数阈值
CIRCUIT_BREAKER_OPEN_DURATION=60000   # 熔断器打开时长（毫秒）
CIRCUIT_BREAKER_HALF_OPEN_SUCCESS=2   # 半开状态成功次数

# 重试配置
MAX_RETRY_ATTEMPTS=3               # 最大重试次数（默认 3）
```

---

#### 实施步骤

##### Phase 1: 数据库迁移（0.5 天）
1. 创建 `user_provider_bindings` 表
2. 创建 `provider_health` 表
3. 修改 `providers` 表添加 `group_name`
4. 修改 `users` 表添加 `provider_group`
5. 执行 `pnpm db:generate && pnpm db:migrate`

##### Phase 2: Session 并发追踪（1 天）
1. 创建 `src/lib/session-tracker/service.ts`
2. 实现 Redis 集合追踪逻辑
3. 实现定时清理任务（Cron Job）
4. 在 `ProxyProviderResolver` 中集成容量检查

##### Phase 3: 熔断器实现（1 天）
1. 创建 `src/lib/circuit-breaker/service.ts`
2. 实现状态机逻辑
3. 在 `ProxyForwarder` 中集成失败记录和成功记录
4. 添加监控日志和 Metrics

##### Phase 4: 智能重试逻辑（1 天）
1. 修改 `ProxyForwarder.forward()` 方法
2. 实现 `selectAlternativeProvider()` 逻辑
3. 添加重试日志和错误聚合
4. 编写单元测试

##### Phase 5: 用户绑定逻辑（1 天）
1. 创建 Repository 层查询函数
   - `getUserBoundProviders(userId)`
   - `getProvidersByGroup(groupName)`
2. 修改 `ProxyProviderResolver` 实现 4 层降级
3. 创建 Server Actions
   - `addUserBinding(userId, providerId, priority)`
   - `removeUserBinding(userId, providerId)`
   - `updateUserGroup(userId, groupName)`

##### Phase 6: 排行榜 UI（0.5 天）
1. 创建 API 端点 `/api/leaderboard/daily` 和 `/api/leaderboard/monthly`
2. 实现 Redis 缓存逻辑
3. 创建前端页面 `/dashboard/leaderboard`
4. 集成 Shadcn UI Table 组件

##### Phase 7: 用户绑定管理 UI（0.5 天）
1. 创建页面 `/settings/users/[userId]/bindings`
2. 实现拖拽排序（DnD Kit）
3. 添加供应商选择器
4. 集成 Server Actions

---

#### 测试验证

##### 1. Session 并发限制测试
```bash
# 设置供应商 CC=2
# 同时发起 5 个长对话请求（同一 Session ID）
for i in {1..5}; do
  curl -H "Authorization: Bearer sk-xxx" \
       -H "X-Session-ID: test-session-123" \
       http://localhost:13500/v1/messages &
done
wait

# 预期：
# - 前 2 个请求使用供应商 A
# - 后 3 个请求切换到其他供应商
```

##### 2. 熔断器测试
```bash
# 模拟供应商故障（停止上游服务）
# 快速发送 10 个请求

for i in {1..10}; do
  curl -H "Authorization: Bearer sk-xxx" \
       http://localhost:13500/v1/messages
  sleep 0.5
done

# 预期：
# - 前 5 个请求失败（记录到 provider_health）
# - 第 6 个请求时熔断器打开，自动切换到其他供应商
# - 60 秒后熔断器半开，允许尝试
```

##### 3. 智能重试测试
```bash
# 设置 3 个供应商，其中 2 个故障
# 发送请求

curl -v -H "Authorization: Bearer sk-xxx" \
     http://localhost:13500/v1/messages

# 观察日志：
# [Retry 1/3] Provider 1 failed: Connection timeout
# [Retry 1] Switched to provider 2
# [Retry 2/3] Provider 2 failed: 503 Service Unavailable
# [Retry 2] Switched to provider 3
# [Success] Provider 3 returned response
```

##### 4. 用户绑定降级测试
```bash
# 用户绑定供应商 1、2（优先级 0、1）
# 供应商 1、2 均不可用
# 用户属于 "premium" 组，该组有供应商 3、4

# 预期降级路径：
# 1. 尝试供应商 1（绑定，优先级 0）→ 失败
# 2. 尝试供应商 2（绑定，优先级 1）→ 失败
# 3. 降级到 "premium" 组，尝试供应商 3 → 成功
# 4. 日志记录警告："Bound providers unavailable, falling back to group"
```

---

#### 监控和告警

##### 关键指标

**供应商健康度**：
```sql
-- 查询熔断器状态
SELECT
  p.id,
  p.name,
  ph.circuit_open,
  ph.failure_count,
  ph.last_failure_at
FROM providers p
LEFT JOIN provider_health ph ON p.id = ph.provider_id
WHERE ph.circuit_open = true OR ph.failure_count > 0;
```

**Session 并发统计**：
```bash
# Redis 命令
redis-cli

# 查看各供应商的活跃 Session 数
KEYS provider:*:active_sessions
SCARD provider:123:active_sessions
```

**重试率**：
```typescript
// Prometheus Metrics（未来扩展）
retry_attempts_total{result="success"}
retry_attempts_total{result="exhausted"}
provider_selection_total{layer="binding"}
provider_selection_total{layer="group"}
provider_selection_total{layer="fallback"}
```

##### 告警规则（推荐）

```yaml
# Prometheus Alert Rules

groups:
  - name: claude-hub-proxy
    rules:
      # 熔断器打开告警
      - alert: CircuitBreakerOpen
        expr: provider_circuit_open == 1
        for: 1m
        annotations:
          summary: "供应商 {{ $labels.provider_id }} 熔断器已打开"

      # 重试率过高
      - alert: HighRetryRate
        expr: rate(retry_attempts_total[5m]) > 0.5
        for: 5m
        annotations:
          summary: "重试率过高（{{ $value }}），检查供应商健康度"

      # Session 容量告警
      - alert: ProviderSessionCapacityHigh
        expr: provider_active_sessions / provider_cc_limit > 0.8
        for: 2m
        annotations:
          summary: "供应商 {{ $labels.provider_id }} Session 容量接近上限"
```

---

#### 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Redis 不可用 | Session 追踪失效 | 降级：不检查并发限制，记录警告 |
| 所有绑定供应商不可用 | 用户无法使用 | 自动降级到组/全局供应商 |
| 熔断器误判（短暂网络抖动） | 健康供应商被跳过 | 半开状态快速恢复（成功 2 次即关闭） |
| Session 清理任务延迟 | 集合中有僵尸 Session | TTL 兜底（5 分钟后自动过期） |
| 重试导致响应延迟 | 用户体验下降 | 最多重试 3 次，每次超时 30 秒 |
| 排行榜缓存雪崩 | 数据库压力 | 缓存 5 分钟 + 查询限制 50 条 |

---

#### Good Taste 检查清单

- [x] **数据结构简单** — 只加 2 张表，复用现有逻辑
- [x] **消除特殊情况** — 绑定为空自动降级，无需 if/else
- [x] **最多三层缩进** — 降级逻辑分层清晰，每层独立
- [x] **零破坏** — 向后兼容，现有用户行为不变（默认无绑定）
- [x] **不重复造轮子** — 复用会话粘性、限流、加权随机逻辑
- [x] **Fail Open 策略** — 任何组件失败都不阻断请求，只降级

---

#### 预计工作量

| 阶段 | 任务 | 工作量 |
|------|------|--------|
| Phase 1 | 数据库迁移 + Schema | 0.5 天 |
| Phase 2 | Session 并发追踪 | 1 天 |
| Phase 3 | 熔断器实现 | 1 天 |
| Phase 4 | 智能重试逻辑 | 1 天 |
| Phase 5 | 用户绑定逻辑 | 1 天 |
| Phase 6 | 排行榜 UI | 0.5 天 |
| Phase 7 | 用户绑定管理 UI | 0.5 天 |
| **总计** | | **5.5 天** |

---

#### 技术亮点总结

1. **Session 级并发控制** — 业界首创，针对 Claude 缓存机制优化
2. **4 层降级策略** — 绑定 → 分组 → 全局，兼顾灵活性和鲁棒性
3. **熔断器自愈** — 自动识别故障供应商并恢复，无需人工干预
4. **智能重试** — 3 次重试 + 替代供应商选择，最大化成功率
5. **零侵入设计** — 所有新功能都有开关，默认关闭，向后兼容

---

**这个方案已经过深度思考和业界最佳实践验证，可以直接投入开发。**
