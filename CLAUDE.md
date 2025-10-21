
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

### Codex 支持架构

#### OpenAI Compatible API 实现

本系统支持 OpenAI Chat Completions API 格式，可直接对接 Codex 类型供应商。核心组件位于 `src/app/v1/_lib/codex/`：

**请求流程**：
```
客户端 (OpenAI 格式)
  → /v1/chat/completions 端点
  → RequestTransformer (OpenAI → Response API)
  → 复用现有代理流程 (认证、限流、路由)
  → ProxyForwarder 转发到 Codex 供应商
  → ResponseTransformer (Response API → OpenAI)
  → 客户端 (OpenAI 格式)
```

**核心组件**：

1. **RequestTransformer** (`transformers/request.ts`)
   - 转换 OpenAI Chat Completion 请求为 Response API 格式
   - 处理 `messages` → `input` 转换
   - 支持 `reasoning`、`max_tokens`、`temperature` 等参数映射

2. **ResponseTransformer** (`transformers/response.ts`)
   - 转换 Response API 响应为 OpenAI 格式
   - 映射 `content` → `choices[].message.content`
   - 处理 `usage` 统计信息

3. **StreamTransformer** (`transformers/stream.ts`)
   - 处理 SSE 流式响应转换
   - `message_start` → 初始 chunk
   - `content_block_delta` → 增量内容 chunk
   - `message_delta` → usage 统计 chunk

4. **ChatCompletionsHandler** (`chat-completions-handler.ts`)
   - 统一入口，处理 `/v1/chat/completions` 请求
   - 标记 `originalFormat = 'openai'`（用于响应转换）
   - 调用 `ProxyProviderResolver` 时指定供应商类型为 `'codex'`

**供应商隔离机制**：

- 数据库字段：`providers.provider_type` (`'claude'` | `'codex'`)
- 路由策略：OpenAI 请求仅选择 `provider_type = 'codex'` 的供应商
- Claude 请求仅选择 `provider_type = 'claude'` 的供应商（默认）

**模型重定向**：

- 数据库字段：`providers.model_redirects` (JSONB)
- 示例配置：`{"gpt-5": "gpt-5-codex", "gpt-4": "gpt-4-turbo"}`
- ModelRedirector 在转发前自动重写模型名称

**会话粘性**：

- OpenAI 请求通过 `conversation_id` 识别会话
- Session 5 分钟内复用同一供应商（利用上下文缓存）
- Redis key: `session:{conversationId}:provider`

**价格管理**：

- 支持为 OpenAI 格式模型单独配置价格（如 `gpt-5-codex`）
- 价格表 `model_prices` 同时支持 Claude 和 OpenAI 模型
- 自动按 `usage.input_tokens` 和 `usage.output_tokens` 计费

### 数据库 Schema

核心表 (`src/drizzle/schema.ts`)：
- **users** - 用户表 (RPM 限制、每日额度)
- **keys** - API 密钥表
- **providers** - 上游供应商表 (URL、权重、流量限制)
  - `provider_type` - 供应商类型 (`'claude'` | `'codex'`)，默认 `'claude'`
  - `model_redirects` - 模型重定向映射 (JSONB)，如 `{"gpt-5": "gpt-5-codex"}`
- **message_request** - 请求日志表 (成本追踪)
  - `api_type` - API 类型 (`'chat'` | `'codex'`)，用于区分不同的请求格式
  - `status_code` - HTTP 状态码
  - `input_tokens`, `output_tokens` - Token 使用统计
  - `cache_creation_input_tokens`, `cache_read_input_tokens` - 缓存 Token 统计
  - `provider_chain` - 供应商调用链 (JSON)，记录重试和降级路径
- **model_prices** - 模型价格表
  - 支持 Claude 模型（如 `claude-sonnet-4-5`）和 OpenAI 模型（如 `gpt-5-codex`）
  - 独立配置输入/输出/缓存 Token 单价

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

