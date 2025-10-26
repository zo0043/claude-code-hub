#!/bin/bash

# Claude Code Hub Docker Compose 简化启动脚本

# 设置颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BLUE='\033[0;34m'
NC='\033[0m'

# 服务状态检查
check_services() {
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker &> /dev/null; then
                DOCKER_COMPOSE="docker compose"
    else
        echo -e "${YELLOW}❌ Docker Compose 命令未安装，使用标准Docker命令"
        return 1
    fi

    docker compose ps --format "table {{.Service}}\t{{.Status}}" | grep -q "Up"
}

    # 返回 0 表示未运行，返回 1 表示正在运行
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 服务正在运行中"
        return 0
    else
        return 1
    fi
}

# 启动服务
start_services() {
    echo -e "${GREEN}启动服务中..."
    docker compose -f docker-compose.yaml up -d postgres redis
    if [ $? -eq 0 ]; then
        # 等待数据库就绪
        echo -e "${YELLOW}⏳ 等待数据库服务就绪..."
        local retry_count=0
        local max_retries=30
        while [ $retry_count -lt $max_retries ]; do
            docker compose exec -T postgres pg_isready -U postgres -d claude_code_hub &>/dev/null 2>&1 | grep -q "accepting connections" >/dev/null && \
                echo -e "${GREEN}✅ 数据库已就绪" && break
            fi

            retry_count=$((retry_count + 1))
            sleep 2
        done

        if [ $retry_count -eq $max_retries ]; then
            echo -e "${YELLOW}❌ 数据库服务启动超时"
            return 1
        fi

        return 0
    else
        echo -e "${RED}❌ Docker Compose 启动失败"
        return 1
    fi
}

# 停止服务
stop_services() {
    echo -e "${GREEN}停止服务中..."
    docker compose down
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 服务已停止"
    else
        echo -e "${RED}❌ Docker Compose 停止失败"
        return 1
    fi
}

# 重启服务
restart_services() {
    echo -e "${GREEN}重启服务中..."
    stop_services
    sleep 2
    start_services
}

# 查看日志
show_logs() {
    if [ "$1" ]; then
        docker compose logs -f "$1"
    else
        docker compose logs
    fi
}

# 帮助信息
usage() {
    echo -e "${BLUE}Claude Code Hub Docker 管理 v1.0"
    echo -e ""
    echo "用法: $0 [选项]"
    echo -e "  start                启动数据库和Redis服务"
    echo -e "  stop                停止所有服务"
    echo -e "  restart              重启所有服务"
    echo -e "  logs                查看服务日志"
    echo -e ""
    echo -e "  --clean              清理构建文件"
    echo -e "  --deep-clean       深度清理并重装依赖"
    echo -e "  --no-typecheck     跳过 TypeScript 类型检查"
    echo -e "  --no-lint         跳过代码检查"
    echo -e "  --docker          构建完成后构建 Docker 镜像"
    echo -e "  --all             执行所有操作包括 Docker 镜像构建"
    echo -e "  --dev             开发模式快速构建（跳过某些检查）"
    echo -e ""
    echo ""
    echo -e "示例:"
    echo -e "  $0                 # 标准构建"
    echo -e "  $0 --clean        # 清理并构建"
    echo -e "  $0 --deep-clean    # 深度清理并重新安装"
    echo -e "  $0 --docker       # 构建并创建Docker镜像"
    echo -e "  $0 --all          # 完整构建流程"
    echo -e "  $0 --dev          # 开发模式快速构建"
}

# 参数解析
ARGS=("$@")

case $1 in
    up|start)
                start_services
                ;;
    down|stop)
                stop_services
                ;;
    restart)
                restart_services
                ;;
        clean)
                clean_build
                ;;
        logs)
                show_logs "$2"
                ;;
        build)
                build_image
                ;;
        --all)
                build_image
                start_services
                ;;
        --no-build)
                start_services
                ;;
        --verbose)
                VERBOSE=true
                ;;
        --help|*)
                show_help
                ;;
        *)
                echo -e "${RED}未知命令: $1"
                show_help
                ;;
        esac
done

# 主程序
main "$@"