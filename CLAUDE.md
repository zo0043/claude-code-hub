
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
