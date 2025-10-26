# Claude Code Hub 构建指南

本项目提供了完整的构建脚本和工具，用于重新构建和重新打包前端应用。

## 构建脚本

### Linux/macOS: `build.sh`

功能完整的构建脚本，支持多种构建模式和选项。

#### 基本用法

```bash
# 标准构建
./build.sh

# 显示帮助信息
./build.sh --help
```

#### 可用选项

| 选项 | 描述 |
|------|------|
| `--help`, `-h` | 显示帮助信息 |
| `--clean` | 清理构建文件（保留 node_modules） |
| `--deep-clean` | 深度清理（删除 node_modules 并重新安装） |
| `--no-typecheck` | 跳过 TypeScript 类型检查 |
| `--no-lint` | 跳过代码检查 |
| `--docker` | 构建完成后创建 Docker 镜像 |
| `--all` | 执行完整流程（清理 + Docker 镜像） |
| `--dev` | 开发模式快速构建（跳过类型和代码检查） |

#### 使用示例

```bash
# 标准构建流程
./build.sh

# 清理并重新构建
./build.sh --clean

# 深度清理并重新构建
./build.sh --deep-clean

# 开发模式快速构建（跳过检查）
./build.sh --dev

# 构建并创建 Docker 镜像
./build.sh --docker

# 完整构建流程（包含所有检查和 Docker）
./build.sh --all
```

### Windows: `build.bat`

Windows 批处理文件，提供类似的构建功能。

```batch
# 标准构建
build.bat

# 深度清理并构建
build.bat --deep-clean

# 跳过类型检查的构建
build.bat --clean --no-typecheck
```

## NPM 脚本

在 `package.json` 中预定义了几个便捷的构建脚本：

```bash
# 标准 Next.js 构建
pnpm build

# 使用完整构建脚本
pnpm run build:full

# 清理并构建
pnpm run build:clean

# 深度清理并构建
pnpm run build:deep

# 构建并创建 Docker 镜像
pnpm run build:docker

# 完整构建流程
pnpm run build:all

# 开发模式快速构建
pnpm run build:dev

# Docker Compose 管理
pnpm run docker:up      # 启动 Docker Compose 服务
pnpm run docker:down    # 停止 Docker Compose 服务
pnpm run docker:restart # 重启 Docker Compose 服务
pnpm run docker:logs    # 查看 Docker Compose 日志
```

## 构建流程

构建脚本执行以下步骤：

1. **依赖检查** - 验证 Node.js 和 pnpm 已安装
2. **清理构建文件** - 删除旧的 `.next` 和 `out` 目录
3. **安装/更新依赖** - 根据需要安装或更新 node_modules
4. **类型检查** - 运行 TypeScript 类型验证（可跳过）
5. **代码检查** - 运行 ESLint 代码质量检查（可跳过）
6. **前端构建** - 使用 Next.js 构建生产版本
7. **构建验证** - 验证关键构建文件存在
8. **构建信息生成** - 创建 `build-info.json` 文件
9. **Docker 镜像构建**（可选）- 创建 Docker 镜像

## 构建输出

构建完成后，会在以下位置生成文件：

```
.next/standalone/
├── server.js              # 生产服务器入口文件
├── .next/static/          # 静态资源文件
├── node_modules/          # 生产依赖
├── VERSION               # 版本信息文件
└── build-info.json      # 构建信息（自动生成）
```

### 构建信息示例

```json
{
  "buildTime": "2025-10-26T13:50:00Z",
  "gitCommit": "abc1234",
  "gitBranch": "main",
  "nodeVersion": "v18.19.0",
  "buildMode": "production",
  "features": {
    "keyLengthLimit": 1000,
    "databaseSchema": "latest",
    "apiVersion": "v1"
  }
}
```

## 运行构建的应用

### 生产模式

```bash
# 使用构建好的 standalone 版本
node .next/standalone/server.js
```

### Docker 模式

```bash
# 如果构建了 Docker 镜像
docker run -p 23000:23000 claude-code-hub:latest

# 或者使用 docker-compose
docker compose up -d
```

## 环境变量

构建过程中会设置以下环境变量：

- `NODE_ENV=production` - 生产模式构建
- `NEXT_TELEMETRY_DISABLED=1` - 禁用 Next.js 遥测

## 故障排查

### 常见问题

1. **构建失败**
   ```bash
   # 检查 Node.js 版本
   node --version

   # 清理并重新安装依赖
   ./build.sh --deep-clean
   ```

2. **类型检查错误**
   ```bash
   # 跳过类型检查进行构建
   ./build.sh --no-typecheck

   # 或者单独运行类型检查查看详细错误
   pnpm typecheck
   ```

3. **Docker 构建失败**
   ```bash
   # 确保 Dockerfile 存在
   ls -la Dockerfile

   # 手动构建 Docker 镜像
   docker build -t claude-code-hub:latest .
   ```

4. **内存不足**
   ```bash
   # 设置 Node.js 内存限制
   export NODE_OPTIONS="--max-old-space-size=4096"
   ./build.sh
   ```

## 性能优化

- 使用 `--dev` 选项进行快速迭代构建
- 在 CI/CD 环境中使用 `--all` 选项确保完整构建
- 定期运行 `--deep-clean` 清理依赖缓存

## 集成到 CI/CD

```yaml
# GitHub Actions 示例
- name: Build Application
  run: |
    chmod +x build.sh
    ./build.sh --all

- name: Build Docker Image
  run: |
    docker build -t claude-code-hub:${{ github.sha }} .
    docker tag claude-code-hub:${{ github.sha }} claude-code-hub:latest
```

## 版本信息

- **当前版本**: 0.1.50
- **密钥长度限制**: 1000 字符
- **API 版本**: v1
- **数据库 Schema**: 最新版本