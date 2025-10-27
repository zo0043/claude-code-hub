#!/bin/bash

# Claude Code Hub 构建脚本
# 包含重新构建和重新打包前端的逻辑

set -e  # 遇到错误立即退出

# 颜色输出函数
print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

# 检查必要的工具
check_dependencies() {
    print_info "检查构建依赖..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        exit 1
    fi

    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm 未安装"
        exit 1
    fi

    print_success "依赖检查通过"
}

# 清理旧的构建文件
clean_build() {
    print_info "清理旧的构建文件..."

    # 清理 Next.js 构建文件
    rm -rf .next
    rm -rf out

    # 清理 node_modules（可选）
    if [[ "$1" == "--deep-clean" ]]; then
        print_warning "执行深度清理，删除 node_modules..."
        rm -rf node_modules
        print_info "重新安装依赖..."
        pnpm install
    fi

    print_success "构建文件清理完成"
}

# 安装/更新依赖
install_dependencies() {
    print_info "检查并安装依赖..."

    if [[ ! -d "node_modules" ]] || [[ ! -f "pnpm-lock.yaml" ]]; then
        print_info "安装依赖..."
        pnpm install
    else
        print_info "依赖已存在，检查更新..."
        pnpm install --frozen-lockfile
    fi

    print_success "依赖安装完成"
}

# 运行类型检查
run_typecheck() {
    print_info "运行 TypeScript 类型检查..."

    if pnpm typecheck; then
        print_success "TypeScript 类型检查通过"
    else
        print_error "TypeScript 类型检查失败"
        exit 1
    fi
}

# 运行代码检查
run_lint() {
    print_info "运行代码检查..."

    if pnpm lint; then
        print_success "代码检查通过"
    else
        print_warning "代码检查发现问题，但继续构建..."
    fi
}

# 构建前端
build_frontend() {
    print_info "开始构建前端应用..."

    # 设置构建环境变量
    export NODE_ENV=production
    export NEXT_TELEMETRY_DISABLED=1

    # 执行构建
    if pnpm build; then
        print_success "前端构建完成"
    else
        print_error "前端构建失败"
        exit 1
    fi
}

# 验证构建结果
verify_build() {
    print_info "验证构建结果..."

    # 检查关键文件是否存在
    local required_files=(".next/standalone/server.js" ".next/standalone/.next")

    for file in "${required_files[@]}"; do
        if [[ ! -e "$file" ]]; then
            print_error "构建验证失败：缺少 $file"
            exit 1
        fi
    done

    # 检查关键manifest文件
    local manifest_files=(
        ".next/standalone/.next/build-manifest.json"
        ".next/standalone/.next/app-build-manifest.json"
        ".next/standalone/.next/required-server-files.json"
    )

    for file in "${manifest_files[@]}"; do
        if [[ -e "$file" ]]; then
            print_info "找到构建manifest: $(basename $file)"
        else
            print_warning "未找到构建manifest: $(basename $file)"
        fi
    done

    # 检查静态资源（可能在不同位置）
    local static_locations=(
        ".next/standalone/.next/static"
        ".next/standalone/.next/server/pages"
        ".next/standalone/.next/server/app"
    )

    for location in "${static_locations[@]}"; do
        if [[ -d "$location" ]]; then
            print_info "找到静态资源目录: $location"
            break
        fi
    done

    # 检查构建大小
    if [[ -d ".next/standalone" ]]; then
        local build_size=$(du -sh .next/standalone | cut -f1)
        print_info "构建大小: $build_size"
    fi

    print_success "构建验证通过"
}

# 构建Docker镜像（可选）
build_docker() {
    if [[ "$1" == "--docker" ]] || [[ "$1" == "--all" ]]; then
        print_info "构建Docker镜像..."

        if [[ -f "Dockerfile" ]]; then
            docker build -t claude-code-hub:latest .
            print_success "Docker镜像构建完成"
        else
            print_warning "未找到 Dockerfile，跳过Docker镜像构建"
        fi
    fi
}

# 生成构建信息
generate_build_info() {
    print_info "生成构建信息..."

    local build_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    local node_version=$(node --version)

    cat > build-info.json << EOF
{
  "buildTime": "$build_time",
  "gitCommit": "$git_commit",
  "gitBranch": "$git_branch",
  "nodeVersion": "$node_version",
  "buildMode": "production",
  "features": {
    "keyLengthLimit": 1000,
    "databaseSchema": "latest",
    "apiVersion": "v1"
  }
}
EOF

    print_success "构建信息已生成: build-info.json"
}

# 检查 Docker Compose 服务状态
check_docker_services() {
    print_info "检查 Docker Compose 服务状态..."

    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_warning "未找到 Docker 或 Docker Compose，跳过服务检查"
        return 1
    fi

    # 检查服务状态
    if $DOCKER_COMPOSE ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null | grep -q "running"; then
        print_info "Docker 服务正在运行"
        return 0
    else
        print_info "Docker 服务未运行"
        return 1
    fi
}

# 启动 Docker Compose 服务
start_docker_services() {
    print_info "启动 Docker Compose 服务..."

    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "未找到 Docker 或 Docker Compose"
        return 1
    fi

    # 启动数据库和Redis（跳过app服务）
    if $DOCKER_COMPOSE up -d postgres redis; then
        print_success "Docker 服务启动成功"

        # 等待服务就绪
        print_info "等待数据库服务就绪..."
        local retry_count=0
        local max_retries=30

        while [ $retry_count -lt $max_retries ]; do
            if docker compose exec -T postgres pg_isready -U postgres -d claude_code_hub &> /dev/null; then
                print_success "数据库服务已就绪"
                break
            fi

            retry_count=$((retry_count + 1))
            sleep 2
        done

        if [ $retry_count -eq $max_retries ]; then
            print_error "数据库服务启动超时"
            return 1
        fi

        return 0
    else
        print_error "Docker 服务启动失败"
        return 1
    fi
}

# 停止当前运行的 Docker Compose 服务并重新构建启动
rebuild_and_restart_docker() {
    print_info "停止当前 Docker Compose 服务..."

    # 获取docker compose命令
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "未找到 Docker 或 Docker Compose"
        return 1
    fi

    # 停止所有服务
    if $DOCKER_COMPOSE down; then
        print_success "Docker Compose 服务已停止"
    else
        print_warning "Docker Compose 服务停止时遇到问题，继续执行..."
    fi

    # 等待容器完全停止
    print_info "等待容器完全停止..."
    sleep 3

    # 重新构建镜像
    print_info "重新构建 Docker 镜像..."
    if $DOCKER_COMPOSE build; then
        print_success "Docker 镜像重新构建完成"
    else
        print_error "Docker 镜像重新构建失败"
        return 1
    fi

    # 重新启动所有服务
    print_info "重新启动 Docker Compose 服务..."
    if $DOCKER_COMPOSE up -d; then
        print_success "Docker Compose 服务重新启动完成"

        # 等待服务就绪
        sleep 5
        print_info "等待服务完全启动..."

        # 检查服务状态
        local retry_count=0
        local max_retries=30

        while [ $retry_count -lt $max_retries ]; do
            if curl -s http://localhost:23000 > /dev/null 2>&1; then
                print_success "应用服务已就绪并响应请求"
                break
            fi

            retry_count=$((retry_count + 1))
            if [ $retry_count -eq $max_retries ]; then
                print_warning "应用服务可能仍在启动中，请稍后手动检查"
            fi
            sleep 2
        done

        return 0
    else
        print_error "Docker Compose 服务重新启动失败"
        return 1
    fi
}

# 停止 Docker Compose 服务
stop_docker_services() {
    print_info "停止 Docker Compose 服务..."

    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "未找到 Docker 或 Docker Compose"
        return 1
    fi

    if $DOCKER_COMPOSE down; then
        print_success "Docker 服务已停止"
        return 0
    else
        print_error "Docker 服务停止失败"
        return 1
    fi
}

# 预拉取Docker镜像
pull_docker_images() {
    local compose_file="docker-compose.full.yaml"
    print_info "预拉取Docker镜像..."

    # 获取docker compose命令
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "未找到 Docker 或 Docker Compose"
        return 1
    fi

    # 预拉取镜像
    if $DOCKER_COMPOSE -f "$compose_file" pull --ignore-pull-failures; then
        print_success "镜像预拉取完成"
        return 0
    else
        print_warning "部分镜像预拉取失败，将在启动时重试"
        return 0  # 不视为致命错误
    fi
}

# 启动完整服务栈
start_full_services() {
    local compose_file="docker-compose.full.yaml"
    print_info "启动完整服务栈（使用 $compose_file）..."

    # 检查compose文件是否存在
    if [[ ! -f "$compose_file" ]]; then
        print_error "未找到 $compose_file 文件"
        return 1
    fi

    # 检查Docker镜像是否存在
    if ! docker image inspect claude-code-hub:latest >/dev/null 2>&1; then
        print_error "未找到 claude-code-hub:latest 镜像"
        print_info "请先运行构建: ./build.sh --docker"
        return 1
    fi

    # 获取docker compose命令
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "未找到 Docker 或 Docker Compose"
        return 1
    fi

    # 先预拉取基础镜像（postgres, redis）
    print_info "预拉取基础镜像..."
    $DOCKER_COMPOSE -f "$compose_file" pull postgres redis --ignore-pull-failures

    # 启动完整服务栈，带重试机制
    local max_retries=3
    local retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        print_info "尝试启动服务 (第 $((retry_count + 1))/$max_retries 次)..."

        if $DOCKER_COMPOSE -f "$compose_file" up -d; then
            print_success "完整服务栈启动成功"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                print_warning "服务启动失败，等待10秒后重试..."
                sleep 10

                # 检查Docker服务状态
                if ! docker info >/dev/null 2>&1; then
                    print_error "Docker服务未运行，请检查Docker服务状态"
                    return 1
                fi
            fi
        fi
    done

    print_error "服务启动失败，已重试 $max_retries 次"

    # 提供故障排查建议
    print_info "故障排查建议:"
    print_info "1. 检查claude-code-hub:latest镜像是否存在: docker images | grep claude-code-hub"
    print_info "2. 检查网络连接和Docker Hub访问"
    print_info "3. 尝试手动拉取基础镜像: docker pull postgres:18"
    print_info "4. 检查Docker服务状态: docker info"
    print_info "5. 查看详细日志: docker compose -f $compose_file logs"

    return 1
}

# 等待所有服务就绪
wait_for_services_ready() {
    local timeout=${1:-60}
    local compose_file="docker-compose.full.yaml"
    print_info "等待服务就绪（超时: ${timeout}秒）..."

    # 获取docker compose命令
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "未找到 Docker 或 Docker Compose"
        return 1
    fi

    # 检查数据库服务
    print_info "等待数据库服务就绪..."
    local retry_count=0
    while [ $retry_count -lt $timeout ]; do
        if $DOCKER_COMPOSE -f "$compose_file" exec -T postgres pg_isready -U postgres -d claude_code_hub &> /dev/null; then
            print_success "数据库服务已就绪"
            break
        fi

        retry_count=$((retry_count + 1))
        if [ $((retry_count % 10)) -eq 0 ]; then
            print_info "等待数据库服务... ($retry_count/$timeout)"
        fi
        sleep 1
    done

    if [ $retry_count -eq $timeout ]; then
        print_error "数据库服务启动超时"
        return 1
    fi

    # 检查Redis服务
    print_info "等待Redis服务就绪..."
    retry_count=0
    while [ $retry_count -lt $timeout ]; do
        if $DOCKER_COMPOSE -f "$compose_file" exec -T redis redis-cli ping &> /dev/null; then
            print_success "Redis服务已就绪"
            break
        fi

        retry_count=$((retry_count + 1))
        if [ $((retry_count % 10)) -eq 0 ]; then
            print_info "等待Redis服务... ($retry_count/$timeout)"
        fi
        sleep 1
    done

    if [ $retry_count -eq $timeout ]; then
        print_error "Redis服务启动超时"
        return 1
    fi

    # 等待应用服务启动（额外等待时间）
    print_info "等待应用服务启动..."
    sleep 10

    # 检查应用服务是否响应
    local app_port=23000
    retry_count=0
    while [ $retry_count -lt 30 ]; do
        if curl -s http://localhost:$app_port > /dev/null 2>&1; then
            print_success "应用服务已就绪并响应请求"
            break
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -eq 30 ]; then
            print_warning "应用服务可能仍在启动中，请稍后手动检查"
        fi
        sleep 2
    done

    print_success "所有服务已就绪！"
    return 0
}

# 重启 Docker Compose 服务（使用新的重建重启逻辑）
restart_docker_services() {
    print_info "重启 Docker Compose 服务..."
    rebuild_and_restart_docker
}

# 查看 Docker Compose 日志
show_docker_logs() {
    print_info "显示 Docker Compose 日志..."

    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "未找到 Docker 或 Docker Compose"
        return 1
    fi

    if [ -n "$1" ]; then
        $DOCKER_COMPOSE logs -f "$1"
    else
        $DOCKER_COMPOSE logs -f
    fi
}

# 显示使用帮助
show_help() {
    echo "Claude Code Hub 构建脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "构建选项:"
    echo "  --help, -h          显示帮助信息"
    echo "  --clean            清理构建文件但不删除 node_modules"
    echo "  --deep-clean       深度清理，删除 node_modules 并重新安装"
    echo "  --no-typecheck     跳过 TypeScript 类型检查"
    echo "  --no-lint         跳过代码检查"
    echo "  --docker          构建完成后构建 Docker 镜像"
    echo "  --all             执行所有操作包括 Docker 镜像构建和服务启动"
    echo "  --dev             开发模式构建（快速构建，跳过某些检查）"
    echo ""
    echo "Docker Compose 管理选项:"
    echo "  --docker-up        启动 Docker Compose 服务"
    echo "  --docker-down      停止 Docker Compose 服务"
    echo "  --docker-restart   重启 Docker Compose 服务（包含重新构建）"
    echo "  --docker-logs     显示 Docker Compose 日志"
    echo ""
    echo "示例:"
    echo "  $0                # 标准构建"
    echo "  $0 --clean        # 清理并构建"
    echo "  $0 --deep-clean    # 深度清理并构建"
    echo "  $0 --docker       # 构建并创建Docker镜像"
    echo "  $0 --all          # 完整构建流程（构建+镜像+服务启动）"
    echo "  $0 --dev          # 开发模式快速构建"
    echo ""
    echo "Docker Compose 管理示例:"
    echo "  $0 --docker-up     # 启动数据库和Redis服务"
    echo "  $0 --docker-down   # 停止所有服务"
    echo "  $0 --docker-restart # 重启所有服务"
    echo "  $0 --docker-logs   # 查看服务日志"
}

# 主函数
main() {
    local clean_type=""
    local skip_typecheck=false
    local skip_lint=false
    local build_docker=false
    local dev_mode=false
    local docker_action=""
    local start_services_flag=false

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --clean)
                clean_type="clean"
                shift
                ;;
            --deep-clean)
                clean_type="deep-clean"
                shift
                ;;
            --no-typecheck)
                skip_typecheck=true
                shift
                ;;
            --no-lint)
                skip_lint=true
                shift
                ;;
            --docker)
                build_docker=true
                shift
                ;;
            --all)
                clean_type="clean"
                build_docker=true
                start_services_flag=true
                shift
                ;;
            --dev)
                dev_mode=true
                skip_typecheck=true
                skip_lint=true
                shift
                ;;
            --docker-up|--start-docker)
                docker_action="up"
                shift
                ;;
            --docker-down|--stop-docker)
                docker_action="down"
                shift
                ;;
            --docker-restart)
                docker_action="restart"
                shift
                ;;
            --docker-logs|--show-docker-logs)
                docker_action="logs"
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 处理Docker Compose相关操作
    if [[ -n "$docker_action" ]]; then
        case $docker_action in
            up)
                start_docker_services
                exit $?
                ;;
            down)
                stop_docker_services
                exit $?
                ;;
            restart)
                restart_docker_services
                exit $?
                ;;
            logs)
                show_docker_logs "$2"
                exit $?
                ;;
        esac
    fi

    print_info "开始 Claude Code Hub 构建流程..."
    print_info "构建时间: $(date)"

    # 执行构建步骤
    check_dependencies
    clean_build $clean_type
    install_dependencies

    if [[ "$skip_typecheck" != true ]]; then
        run_typecheck
    else
        print_warning "跳过 TypeScript 类型检查"
    fi

    if [[ "$skip_lint" != true ]] && [[ "$dev_mode" != true ]]; then
        run_lint
    else
        print_warning "跳过代码检查"
    fi

    build_frontend
    verify_build
    generate_build_info
    build_docker $build_docker

    # 启动完整服务栈
    if [[ "$start_services_flag" == true ]]; then
        print_info "开始启动完整服务栈..."

        # 使用新的重建重启逻辑
        if rebuild_and_restart_docker; then
            print_success "所有服务启动完成！"
            print_info "服务访问地址: http://localhost:23000"
            print_info "查看服务状态: docker compose ps"
        else
            print_error "服务启动失败，但构建流程已完成"
            print_info "构建的镜像已可用，可以尝试手动启动服务"
            print_info "手动启动命令: docker compose up -d"
            # 不exit 1，允许构建流程成功完成
        fi
    fi

    print_success "构建流程完成！"
    print_info "构建输出位置:"
    print_info "  - 生产版本: .next/standalone/"
    print_info "  - 静态文件: .next/standalone/.next/static/"
    print_info "  - 构建信息: build-info.json"

    if [[ "$build_docker" == true ]]; then
        print_info "  - Docker镜像: claude-code-hub:latest"
    fi

    print_info ""
    print_info "Docker Compose 管理命令:"
    print_info "  - 启动服务: $0 --docker-up"
    print_info "  - 停止服务: $0 --docker-down"
    print_info "  - 重启服务: $0 --docker-restart"
    print_info "  - 查看日志: $0 --docker-logs"

    print_info ""
    print_info "运行应用:"
    print_info "  - 生产模式: node .next/standalone/server.js"
    print_info "  - Docker模式: docker run -p 23000:23000 claude-code-hub:latest"
    print_info "  - 完整服务栈: docker compose -f docker-compose.full.yaml up -d"
}

# 执行主函数
main "$@"