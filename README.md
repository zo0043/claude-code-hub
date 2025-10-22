<div align="center">

# Claude Code Hub

**🚀 智能 AI API 代理中转服务平台**

专为需要统一管理多个 AI 服务提供商的团队和企业设计

[![Container Image](https://img.shields.io/badge/ghcr.io-ding113%2Fclaude--code--hub-181717?logo=github)](https://github.com/ding113/claude-code-hub/pkgs/container/claude-code-hub)
[![License](https://img.shields.io/github/license/ding113/claude-code-hub)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/ding113/claude-code-hub)](https://github.com/ding113/claude-code-hub/stargazers)

[功能特性](#-功能特性) •
[快速部署](#-快速部署) •
[使用指南](#-使用指南) •
[常见问题](#-常见问题)

</div>

> **💡 致谢**
> 本项目基于 [zsio/claude-code-hub](https://github.com/zsio/claude-code-hub) 二次开发而来。
> 感谢原作者 [@zsio](https://github.com/zsio) 的开源贡献!

---

## ✨ 功能特性

### 核心能力

- **🔄 统一代理** - 一个 API 接口管理所有 AI 服务提供商（OpenAI、Claude、Gemini 等）
- **⚖️ 智能负载** - 基于权重的智能分发 + 自动故障转移 + 会话保持
- **👥 多租户** - 完整的用户体系，细粒度权限控制和配额管理
- **🔑 密钥管理** - API Key 生成、轮换、过期管理
- **📊 实时监控** - 请求统计、成本追踪、性能分析、可视化报表
- **🎨 现代 UI** - 基于 Shadcn UI 的响应式管理面板，深色模式
- **🚀 生产就绪** - Docker 一键部署、自动数据库迁移、健康检查

本项目基于 [zsio/claude-code-hub](https://github.com/zsio/claude-code-hub) 进行了大量增强和优化：

- **📋 详细日志记录** - 完整的请求日志，包含 Token 使用、成本计算、缓存命中等详细信息
- **🔒 并发控制** - 支持为用户和供应商设置并发 Session 限制
- **⏱️ 多时段限流** - 5小时/周/月 三个时间窗口的金额限制，更灵活的配额管理
- **📈 统计排行榜** - 日统计、月统计排行榜，快速了解用户和供应商使用情况
- **🎚️ 优先级路由** - 支持多供应商优先级和权重设置，精细化流量分配
- **🔗 决策链追踪** - 完整的供应商调用链记录，支持错误切换决策链显示
- **🛡️ 熔断保护** - 供应商出错时自动临时熔断，避免重复调用失败的服务
- **💰 价格同步** - 一键拉取 LiteLLM 模型价格表，自动更新价格信息
- **🤖 OpenAI 兼容（即将到来）** - 将于下一大版本支持 Codex，包括模型重定向、价格管理

### 界面预览

<div align="center">

![统计面板](/public/readme/统计.webp)

*实时统计面板 - 请求量、成本、用户活跃度一目了然*

![供应商管理](/public/readme/供应商.webp)

*供应商管理 - 配置上游服务、权重分配、流量限制*

</div>

## 🚀 快速部署

### 前置要求

- Docker 和 Docker Compose
- ⏱️ 仅需 **2 分钟**即可启动完整服务

### 一键部署

使用 `docker-compose.yaml` 启动

<details>
<summary><b>📄 点击展开 docker-compose.yaml 配置文件</b></summary>

```yaml
services:
  postgres:
    image: postgres:18
    container_name: claude-code-hub-db
    restart: unless-stopped
    ports:
      - "35432:5432"
    env_file:
      - ./.env
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-claude_code_hub}
      # 使用自定义数据目录
      PGDATA: /data/pgdata
    volumes:
      # 持久化数据库数据到本地 ./data/postgres 目录
      # 挂载到 /data 而不是 /var/lib/postgresql/data 避免权限冲突
      - ./data/postgres:/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-claude_code_hub}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  redis:
    image: redis:7-alpine
    container_name: claude-code-hub-redis
    restart: unless-stopped
    volumes:
      # 持久化 Redis 数据到本地 ./data/redis 目录
      # 使用 AOF 持久化模式,确保数据不丢失
      - ./data/redis:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s

  app:
    image: ghcr.io/ding113/claude-code-hub:latest
    container_name: claude-code-hub-app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    env_file:
      - ./.env
      - ./.env.local
    environment:
      NODE_ENV: production
      PORT: ${APP_PORT:-23000}
      DSN: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-claude_code_hub}
      REDIS_URL: redis://redis:6379
      ENABLE_RATE_LIMIT: ${ENABLE_RATE_LIMIT:-true}
      SESSION_TTL: ${SESSION_TTL:-300}
    ports:
      - "${APP_PORT:-23000}:${APP_PORT:-23000}"
    restart: unless-stopped

# volumes 配置已移除,改用本地目录映射
# 数据存储在 ./data/postgres 和 ./data/redis 目录
# 重建容器时数据不会丢失,可直接备份 ./data 目录
```

</details>

### 启动服务

```bash
# 启动所有服务（后台运行）
docker compose up -d

# 查看启动日志
docker compose logs -f
```

### 验证部署

**检查服务状态**
   ```bash
   docker compose ps
   ```
   确保三个容器都是 `healthy` 或 `running` 状态：
   - `claude-code-hub-db` (PostgreSQL)
   - `claude-code-hub-redis` (Redis)
   - `claude-code-hub-app` (应用服务)


### 环境变量配置

在项目根目录创建 `.env` 文件：

```bash
# 管理员登录令牌（必须修改为强密码）
ADMIN_TOKEN=!!!change-me-to-a-strong-password!!!

# 数据库配置（可选，已有默认值）
DB_USER=postgres
DB_PASSWORD=!!!change-me!!!
DB_NAME=claude_code_hub
```

<details>
<summary><b>📝 完整环境变量配置说明</b></summary>

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `ADMIN_TOKEN` | ✅ | `change-me` | 管理员登录令牌，**必须修改为强密码** |
| `DB_USER` | ❌ | `postgres` | 数据库用户名 |
| `DB_PASSWORD` | ❌ | `postgres` | 数据库密码（生产环境建议修改） |
| `DB_NAME` | ❌ | `claude_code_hub` | 数据库名称 |
| `AUTO_MIGRATE` | ❌ | `true` | 启动时自动执行数据库迁移 |
| `ENABLE_RATE_LIMIT` | ❌ | `true` | 是否启用限流功能（需要 Redis） |
| `REDIS_URL` | ❌ | `redis://redis:6379` | Redis 连接地址（容器内网络） |
| `SESSION_TTL` | ❌ | `300` | Session 过期时间（秒，5 分钟） |

</details>

### 管理命令

```bash
# 查看日志
docker compose logs -f          # 所有服务
docker compose logs -f app      # 仅应用
docker compose logs -f postgres # 仅数据库
docker compose logs -f redis    # 仅 Redis

# 重启服务
docker compose restart          # 重启所有
docker compose restart app      # 仅重启应用
docker compose restart redis    # 仅重启 Redis

# 停止服务
docker compose stop             # 停止但保留容器
docker compose down             # 停止并删除容器

# 升级到最新版本
docker compose pull             # 拉取最新镜像
docker compose up -d            # 重新创建容器（自动迁移）

# 备份数据
docker exec claude-code-hub-db pg_dump -U postgres claude_code_hub > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复数据
docker exec -i claude-code-hub-db psql -U postgres claude_code_hub < backup.sql

# Redis 操作
docker compose exec redis redis-cli ping           # 检查 Redis 连接
docker compose exec redis redis-cli info stats     # 查看 Redis 统计信息
docker compose exec redis redis-cli --scan         # 查看所有 key
docker compose exec redis redis-cli FLUSHALL       # ⚠️ 清空所有 Redis 数据

# 完全清理（⚠️ 会删除所有数据）
docker compose down        # 停止并删除容器
rm -rf ./data/             # 删除本地数据目录
docker compose up -d       # 重新启动（全新环境）
```

## 📖 使用指南

### 1️⃣ 初始设置

首次访问 http://localhost:23000
使用 `ADMIN_TOKEN` 登录管理后台。

### 2️⃣ 添加 AI 服务提供商

进入 **设置 → 供应商管理**，点击"添加供应商"：

> **📌 重要说明：API 格式兼容性**
>
> 本服务**仅支持 Claude Code 格式**的 API 接口（如智谱 GLM、Kimi、Packy 等）。如果您需要使用其他格式的 AI 服务，比如 Gemini、OpenAI、 Ollama 等格式，请先使用 `claude-code-router` 进行格式转换，然后将转换后的服务地址添加到本系统。

### 3️⃣ 创建用户和密钥

**添加用户**：
1. 进入 **设置 → 用户管理**
2. 点击"添加用户"
3. 配置：
   - 用户名称
   - 描述信息
   - RPM 限制（每分钟请求数）
   - 每日额度（USD）

**生成 API 密钥**：
1. 选择用户，点击"生成密钥"
2. 设置密钥名称
3. 设置过期时间（可选）
4. **⚠️ 复制并保存密钥**（仅显示一次）

### 4️⃣ 使用代理 API

用户使用生成的密钥调用服务：
查看 `http://localhost:23000/usage-doc`

#### 🤖 Codex API（OpenAI 兼容端点）

本服务支持 OpenAI Chat Completions API 格式，可直接对接 Codex 类型的供应商：

**端点**：`POST /v1/chat/completions`

**请求示例**：
```bash
curl -X POST http://localhost:23000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5-codex",
    "messages": [
      {"role": "user", "content": "写一个快速排序算法"}
    ],
    "stream": true
  }'
```

**支持的参数**：
- `model` - 模型名称（可通过供应商配置进行重定向）
- `messages` - 对话消息数组
- `stream` - 是否启用流式输出（默认 false）
- `max_tokens` - 最大输出 token 数
- `temperature` - 温度参数（0-2）
- `top_p` - 核采样参数
- `reasoning` - 推理配置（Codex 专用）

**供应商配置**：
1. 在"供应商管理"中添加 Codex 类型供应商
2. 设置"供应商类型"为 `Codex (OpenAI 推理模型)`
3. 配置"模型重定向"映射（可选）：
   ```json
   {
     "gpt-5": "gpt-5-codex",
     "gpt-4": "gpt-4-turbo"
   }
   ```

**工作流程**：
- 请求自动转换为 Response API 格式
- 根据供应商类型智能路由（仅选择 Codex 类型供应商）
- 响应自动转换回 OpenAI 格式

**价格管理**：
- 支持为 OpenAI 格式模型（如 `gpt-5-codex`）单独配置价格
- 在"价格管理"中添加对应模型的输入/输出 token 单价
- 系统自动按 token 计费


### 5️⃣ 监控和统计

**仪表盘**页面提供：
- 📈 实时请求量趋势
- 💰 成本统计和分析
- 👤 用户活跃度排行
- 🔧 供应商性能对比
- ⚠️ 异常请求监控

### 6️⃣ 配置模型价格

进入 **设置 → 价格管理**，配置各模型的计费单价：

- 支持按模型配置输入/输出 Token 单价（包括 Claude 和 OpenAI 格式模型）
- 支持缓存 Token 单独定价（`cache_creation_input_tokens`、`cache_read_input_tokens`）
- 自动计算请求成本
- 导出成本报表

**OpenAI 模型价格配置示例**：
- 模型名称：`gpt-5-codex`
- 输入价格（USD/M tokens）：`0.003`
- 输出价格（USD/M tokens）：`0.006`

## 🛠️ 常见问题

<details>
<summary><b>❓ 如何重置管理员密码？</b></summary>

编辑 `.env` 文件，修改 `ADMIN_TOKEN`，然后重启应用：
```bash
docker compose restart app
```

</details>

<details>
<summary><b>❓ 端口已被占用怎么办？</b></summary>

编辑 `docker-compose.yaml`，修改端口映射：
```yaml
services:
  app:
    ports:
      - "8080:23000"  # 将 23000 改为任意可用端口

  postgres:
    ports:
      - "15432:5432"  # 修改数据库端口
```

</details>

<details>
<summary><b>❓ 如何查看详细错误日志？</b></summary>

```bash
# 实时查看应用日志
docker compose logs -f app

# 查看最近 200 行日志
docker compose logs --tail=200 app

# 查看数据库日志
docker compose logs -f postgres
```

</details>

<details>
<summary><b>❓ 数据库迁移失败怎么办？</b></summary>

1. 检查数据库连接：
   ```bash
   docker compose exec app sh -c 'echo "SELECT version();" | psql $DSN'
   ```

2. 查看应用日志：
   ```bash
   docker compose logs app | grep -i migration
   ```

3. 手动执行迁移：
   ```bash
   docker compose exec app pnpm db:migrate
   ```

4. 如果持续失败，可以重置数据库（⚠️ 会丢失数据）：
   ```bash
   docker compose down
   rm -rf ./data/postgres
   docker compose up -d
   ```

</details>

<details>
<summary><b>❓ 如何配置反向代理（Nginx + HTTPS）？</b></summary>

Nginx 配置示例：
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:23000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

</details>

<details>
<summary><b>❓ 如何备份和恢复数据？</b></summary>

**数据持久化说明**：
- 数据库和 Redis 数据存储在 `./data/` 目录
- `./data/postgres/` - PostgreSQL 数据
- `./data/redis/` - Redis 持久化数据

**方式 1：直接备份数据目录**（推荐）：
```bash
# 备份整个数据目录
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz ./data/

# 恢复数据
tar -xzf backup_20250121_120000.tar.gz
docker compose restart
```

**方式 2：SQL 备份**（传统方式）：
```bash
# 手动备份
docker exec claude-code-hub-db pg_dump -U postgres claude_code_hub > backup.sql

# 恢复数据
docker exec -i claude-code-hub-db psql -U postgres claude_code_hub < backup.sql
```

**自动备份**（推荐）：
```bash
# 添加到 crontab（每天凌晨 2 点备份）
0 2 * * * cd /path/to/claude-code-hub && tar -czf /backup/data_$(date +\%Y\%m\%d).tar.gz ./data/
```

**迁移到新服务器**：
```bash
# 在旧服务器上
docker compose down
tar -czf backup.tar.gz ./data/

# 在新服务器上
tar -xzf backup.tar.gz
docker compose up -d
```

</details>

<details>
<summary><b>❓ 支持哪些 AI 服务提供商？</b></summary>

**本服务仅支持 Claude Code 格式的 API 接口。**

**直接支持**：
- ✅ 原生提供 Claude Code 格式接口的服务商

**间接支持**（需要先部署 [claude-code-router](https://github.com/zsio/claude-code-router) 进行协议转换）：
- 🔄 智谱 AI (GLM)
- 🔄 Moonshot AI (Kimi)
- 🔄 Packy
- 🔄 阿里通义千问
- 🔄 百度文心一言
- 🔄 其他非 Claude Code 格式的 AI 服务

**接入流程**：
1. 部署 [claude-code-router](https://github.com/zsio/claude-code-router) 服务
2. 在 router 中配置需要接入的上游 AI 服务
3. 将 router 的地址作为供应商添加到本系统

</details>

<details>
<summary><b>❓ 如何监控服务健康状态？</b></summary>

**使用 Docker 健康检查**：
```bash
docker compose ps
```

**查看容器资源使用**：
```bash
docker stats claude-code-hub-app claude-code-hub-db
```

**集成监控工具**（可选）：
- Prometheus + Grafana
- Uptime Kuma
- Zabbix

</details>

<details>
<summary><b>❓ 性能调优建议？</b></summary>

1. **数据库优化**：
   - 定期执行 `VACUUM ANALYZE`
   - 根据实际负载调整连接池大小
   - 为高频查询字段添加索引

2. **应用层优化**：
   - 启用 Redis 缓存（可选）
   - 调整 Node.js 内存限制
   - 使用 CDN 缓存静态资源

3. **基础设施**：
   - 使用 SSD 存储
   - 增加服务器内存
   - 配置负载均衡（多实例部署）

</details>

<details>
<summary><b>❓ Redis 连接失败怎么办？</b></summary>

本服务采用 **Fail Open 策略**，Redis 连接失败不会影响服务可用性：

1. **检查 Redis 状态**：
   ```bash
   docker compose ps redis
   docker compose logs redis
   ```

2. **验证 Redis 连接**：
   ```bash
   docker compose exec redis redis-cli ping
   # 应返回 PONG
   ```

3. **检查应用日志**：
   ```bash
   docker compose logs app | grep -i redis
   # 查看是否有 Redis 连接错误
   ```

4. **降级模式**：
   - Redis 不可用时，限流功能会自动降级
   - 所有请求仍然正常通过
   - 日志会记录警告信息："Redis connection failed, rate limiting disabled"

5. **重启 Redis 服务**：
   ```bash
   docker compose restart redis
   ```

</details>

<details>
<summary><b>❓ 如何查看 Redis 数据？</b></summary>

**查看存储的 Key**：
```bash
# 查看所有 key
docker compose exec redis redis-cli --scan

# 查看特定模式的 key
docker compose exec redis redis-cli --scan --pattern "key:*"
docker compose exec redis redis-cli --scan --pattern "provider:*"
docker compose exec redis redis-cli --scan --pattern "session:*"
```

**查看 Key 的值**：
```bash
# 查看字符串类型的值（成本数据）
docker compose exec redis redis-cli GET "key:123:cost_5h"

# 查看集合类型的值（活跃 Session）
docker compose exec redis redis-cli SMEMBERS "provider:1:active_sessions"

# 查看 Key 的 TTL
docker compose exec redis redis-cli TTL "session:abc123:last_seen"
```

**实时监控 Redis 命令**：
```bash
docker compose exec redis redis-cli MONITOR
```

**查看 Redis 统计信息**：
```bash
docker compose exec redis redis-cli info stats
docker compose exec redis redis-cli info memory
```

</details>

<details>
<summary><b>❓ 如何清空 Redis 缓存？</b></summary>

**清空所有数据**（⚠️ 谨慎操作）：
```bash
docker compose exec redis redis-cli FLUSHALL
```

**清空特定 Key**：
```bash
# 删除特定用户的限流数据
docker compose exec redis redis-cli DEL "key:123:cost_5h"
docker compose exec redis redis-cli DEL "key:123:cost_weekly"

# 删除所有 Session 数据
docker compose exec redis redis-cli EVAL "
  local keys = redis.call('keys', 'session:*')
  for i=1,#keys do
    redis.call('del', keys[i])
  end
  return #keys
" 0
```

**重启 Redis 但保留数据**：
```bash
docker compose restart redis
```

**完全清空并重建**（⚠️ 会丢失所有 Redis 数据）：
```bash
docker compose stop redis
rm -rf ./data/redis
docker compose up -d redis
```

</details>

<details>
<summary><b>❓ Redis 数据会持久化吗？</b></summary>

✅ **会持久化**，配置了双重保障：

1. **AOF（Append Only File）持久化**：
   - 每次写操作都会追加到日志文件
   - 配置：`redis-server --appendonly yes`
   - 重启后自动恢复数据

2. **本地目录持久化**：
   - 数据存储在 `./data/redis` 目录
   - 即使删除容器，数据仍然保留
   - 可直接复制此目录进行备份或迁移

**数据恢复**：
- 正常重启：数据自动恢复
- 迁移到新机器：复制 `./data/redis` 目录到新服务器

**备份 Redis 数据**：
```bash
# 方式 1: 直接复制数据目录（推荐）
cp -r ./data/redis ./redis_backup_$(date +%Y%m%d)

# 方式 2: 手动触发保存
docker compose exec redis redis-cli BGSAVE

# 方式 3: 导出 AOF 文件
docker cp claude-code-hub-redis:/data/appendonly.aof ./redis_backup_$(date +%Y%m%d).aof
```

**注意事项**：
- ⚠️ `docker compose down -v` 会删除容器，但不会删除 `./data` 目录
- ✅ `docker compose down` 或 `docker compose stop` 都是安全的，数据不会丢失
- ✅ 重建容器时（`docker compose up -d --force-recreate`），数据会自动恢复

</details>

<details>
<summary><b>❓ 限流功能如何工作？</b></summary>

**限流机制**：

1. **金额限流**（三个时间窗口）：
   - 5 小时限制：`key:{keyId}:cost_5h`
   - 周限制：`key:{keyId}:cost_weekly`
   - 月限制：`key:{keyId}:cost_monthly`

2. **Session 并发限流**：
   - 追踪活跃 Session 数量（5 分钟 TTL）
   - 防止恶意并发请求
   - Key: `key:{keyId}:active_sessions`

3. **供应商限流**：
   - 保护上游供应商
   - 类似机制：`provider:{id}:cost_*` 和 `active_sessions`

**响应头示例**（触发限流时）：
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 3600
Retry-After: 3600
```

**禁用限流**：
- 设置环境变量 `ENABLE_RATE_LIMIT=false`
- 重启服务：`docker compose restart app`

</details>

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)

## 🌟 Star History

如果这个项目对你有帮助，请给它一个 ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=ding113/claude-code-hub&type=Date)](https://star-history.com/#ding113/claude-code-hub&Date)

## 📞 支持与反馈

<div align="center">

**[🐛 报告问题](https://github.com/ding113/claude-code-hub/issues)** •
**[💡 功能建议](https://github.com/ding113/claude-code-hub/issues/new)** •
**[📖 查看文档](https://github.com/ding113/claude-code-hub/wiki)**

Based on [zsio/claude-code-hub](https://github.com/zsio/claude-code-hub) • Modified by [ding113](https://github.com/ding113)

</div>
