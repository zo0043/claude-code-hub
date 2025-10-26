@echo off
setlocal enabledelayedexpansion

REM Claude Code Hub 构建脚本 (Windows版本)
REM 包含重新构建和重新打包前端的逻辑

echo [INFO] 开始 Claude Code Hub 构建流程...
echo [INFO] 构建时间: %date% %time%

REM 检查依赖
echo [INFO] 检查构建依赖...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 未安装
    exit /b 1
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pnpm 未安装
    exit /b 1
)

echo [SUCCESS] 依赖检查通过

REM 清理旧文件
echo [INFO] 清理旧的构建文件...

if exist ".next" rmdir /s /q ".next"
if exist "out" rmdir /s /q "out"

if "%1"=="--deep-clean" (
    echo [WARNING] 执行深度清理，删除 node_modules...
    if exist "node_modules" rmdir /s /q "node_modules"
    echo [INFO] 重新安装依赖...
    pnpm install
)

echo [SUCCESS] 构建文件清理完成

REM 安装依赖
echo [INFO] 检查并安装依赖...

if not exist "node_modules" (
    echo [INFO] 安装依赖...
    pnpm install
) else (
    echo [INFO] 依赖已存在，检查更新...
    pnpm install --frozen-lockfile
)

echo [SUCCESS] 依赖安装完成

REM 类型检查
if not "%2"=="--no-typecheck" (
    echo [INFO] 运行 TypeScript 类型检查...
    pnpm typecheck
    if %errorlevel% neq 0 (
        echo [ERROR] TypeScript 类型检查失败
        exit /b 1
    )
    echo [SUCCESS] TypeScript 类型检查通过
) else (
    echo [WARNING] 跳过 TypeScript 类型检查
)

REM 代码检查
if not "%3"=="--no-lint" (
    echo [INFO] 运行代码检查...
    pnpm lint
    if %errorlevel% neq 0 (
        echo [WARNING] 代码检查发现问题，但继续构建...
    ) else (
        echo [SUCCESS] 代码检查通过
    )
) else (
    echo [WARNING] 跳过代码检查
)

REM 构建应用
echo [INFO] 开始构建前端应用...

REM 设置构建环境变量
set NODE_ENV=production
set NEXT_TELEMETRY_DISABLED=1

REM 执行构建
pnpm build
if %errorlevel% neq 0 (
    echo [ERROR] 前端构建失败
    exit /b 1
)

echo [SUCCESS] 前端构建完成

REM 验证构建结果
echo [INFO] 验证构建结果...

if not exist ".next\standalone\server.js" (
    echo [ERROR] 构建验证失败：缺少 .next\standalone\server.js
    exit /b 1
)

if not exist ".next\standalone\.next" (
    echo [ERROR] 构建验证失败：缺少 .next\standalone\.next 目录
    exit /b 1
)

REM 检查关键manifest文件
if exist ".next\standalone\.next\build-manifest.json" (
    echo [INFO] 找到构建manifest: build-manifest.json
)

if exist ".next\standalone\.next\app-build-manifest.json" (
    echo [INFO] 找到构建manifest: app-build-manifest.json
)

if exist ".next\standalone\.next\required-server-files.json" (
    echo [INFO] 找到构建manifest: required-server-files.json
)

REM 检查静态资源（可能在不同位置）
if exist ".next\standalone\.next\static" (
    echo [INFO] 找到静态资源目录: .next\standalone\.next\static
)

if exist ".next\standalone\.next\server\pages" (
    echo [INFO] 找到静态资源目录: .next\standalone\.next\server\pages
)

if exist ".next\standalone\.next\server\app" (
    echo [INFO] 找到静态资源目录: .next\standalone\.next\server\app
)

REM 计算构建大小
if exist ".next\standalone" (
    for /f %%i in ('dir /s ".next\standalone" ^| find "bytes" ^| find /v ""') do set size=%%i
    echo [INFO] 构建大小: %size% bytes
)

echo [SUCCESS] 构建验证通过

REM 检查Docker Compose服务状态
:check_docker
echo [INFO] 检查 Docker Compose 服务状态...
docker compose ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] 未找到 Docker Compose，跳过服务检查
    exit /b 1
)

docker compose ps --format "table {{.Service}}\t{{.Status}}" | findstr "running" >nul
if %errorlevel% equ 0 (
    echo [INFO] Docker 服务正在运行
    exit /b 0
) else (
    echo [INFO] Docker 服务未运行
    exit /b 1
)

REM 启动Docker Compose服务
:start_docker
echo [INFO] 启动 Docker Compose 服务...
docker compose up -d postgres redis
if %errorlevel% equ 0 (
    echo [SUCCESS] Docker 服务启动成功

    REM 等待服务就绪
    echo [INFO] 等待数据库服务就绪...
    set /a retry_count=0
    :wait_loop
    set /a retry_count=!retry_count!+1

    docker compose exec -T postgres pg_isready -U postgres -d claude_code_hub >nul 2>&1
    if %errorlevel% equ 0 (
        echo [SUCCESS] 数据库服务已就绪
        goto :build_complete
    )

    if !retry_count! lss 30 (
        echo [ERROR] 数据库服务启动超时
        exit /b 1
    )

    timeout /t 2 >nul
    goto wait_loop
)

:stop_docker
echo [INFO] 停止 Docker Compose 服务...
docker compose down
if %errorlevel% equ 0 (
    echo [SUCCESS] Docker 服务已停止
) else (
    echo [ERROR] Docker 服务停止失败
    exit /b 1
)

:restart_docker
echo [INFO] 重启 Docker Compose 服务...
call :stop_docker
timeout /t 3 >nul
call :start_docker

REM 显示Docker Compose日志
:show_logs
echo [INFO] 显示 Docker Compose 日志...
if "%2"=="" (
    docker compose logs
) else (
    docker compose logs -f %2
)

REM 生成构建信息
echo [INFO] 生成构建信息...

REM 创建构建信息文件
echo { > build-info.json
echo   "buildTime": "%date% %time%", >> build-info.json
echo   "nodeVersion": >> build-info.json
node -e "console.log(process.version)" >> build-info.json
echo   , >> build-info.json
echo   "buildMode": "production", >> build-info.json
echo   "features": { >> build-info.json
echo     "keyLengthLimit": 1000, >> build-info.json
echo     "databaseSchema": "latest", >> build-info.json
echo     "apiVersion": "v1" >> build-info.json
echo   } >> build-info.json
echo } >> build-info.json

echo [SUCCESS] 构建信息已生成: build-info.json

REM Docker镜像构建（如果需要）
if "%1"=="--docker" (
    echo [INFO] 构建 Docker 镜像...
    if exist "Dockerfile" (
        docker build -t claude-code-hub:latest .
        echo [SUCCESS] Docker 镜像构建完成
    ) else (
        echo [WARNING] 未找到 Dockerfile，跳过 Docker 镜像构建
    )
)

echo [SUCCESS] 构建流程完成！
echo [INFO] 构建输出位置:
echo   - 生产版本: .next\standalone\
echo   - 静态文件: .next\standalone\.next\static\
echo   - 构建信息: build-info.json

if "%1"=="--docker" (
    echo   - Docker 镜像: claude-code-hub:latest
)

echo.
REM 根据命令行参数执行不同操作
if "%1"=="--docker-up" (
    call :start_docker
    goto :end
)

if "%1"=="--docker-down" (
    call :stop_docker
    goto :end
)

if "%1"=="--docker-restart" (
    call :restart_docker
    goto :end
)

if "%1"=="--docker-logs" (
    call :show_logs %2
    goto :end
)

echo [INFO] 运行应用:
echo   - 生产模式: node .next\standalone\server.js
echo   - Docker 模式: docker run -p 23000:23000 claude-code-hub:latest

:end