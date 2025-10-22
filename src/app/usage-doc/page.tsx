"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * 文档目录项
 */
interface TocItem {
  id: string;
  text: string;
  level: number;
}

const headingClasses = {
  h2: "scroll-m-20 text-2xl font-semibold leading-snug text-foreground",
  h3: "scroll-m-20 mt-8 text-xl font-semibold leading-snug text-foreground",
  h4: "scroll-m-20 mt-6 text-lg font-semibold leading-snug text-foreground",
} as const;

interface CodeBlockProps {
  code: string;
  language: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <pre
      data-language={language}
      className="group relative my-5 overflow-x-auto rounded-md bg-black px-4 py-5 font-mono text-[13px] text-white"
    >
      <code className="block whitespace-pre leading-relaxed">{code.trim()}</code>
    </pre>
  );
}

interface UsageDocContentProps {
  origin: string;
}

function UsageDocContent({ origin }: UsageDocContentProps) {
  const resolvedOrigin = origin || "当前站点地址";

  return (
    <article className="space-y-12 text-[15px] leading-6 text-muted-foreground">
      <section className="space-y-6">
        <h2 id="quick-start" className={headingClasses.h2}>
          🚀 快速开始
        </h2>

        <div className="space-y-4">
          <h3 id="step-1-install" className={headingClasses.h3}>
            第一步：安装 Claude Code
          </h3>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>开发者（推荐）</h4>
            <p>使用 npm 全局安装：</p>
            <CodeBlock language="bash" code={`npm install -g @anthropic-ai/claude-code`} />
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>非开发者</h4>
            <p>使用一键安装脚本：</p>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">macOS / Linux / WSL</p>
              <CodeBlock language="bash" code={`curl -fsSL https://claude.ai/install.sh | bash`} />
              <p className="font-semibold text-foreground">Windows PowerShell</p>
              <CodeBlock language="powershell" code={`irm https://claude.ai/install.ps1 | iex`} />
            </div>
            <blockquote className="space-y-1 rounded-lg border-l-2 border-primary/50 bg-muted/40 px-4 py-3">
              <p className="font-semibold text-foreground">提示</p>
              <p>Windows 用户建议使用 WSL (Windows Subsystem for Linux) 以获得更好的体验</p>
            </blockquote>
          </div>
        </div>

        <div className="space-y-4">
          <h3 id="step-2-config" className={headingClasses.h3}>
            第二步：配置 API 密钥
          </h3>
          <div className="space-y-3">
            <h4 className={headingClasses.h4}>1. 创建配置文件</h4>
            <p>
              根据您的操作系统，在对应位置创建{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                settings.json
              </code>{" "}
              文件：
            </p>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-foreground">macOS / Linux</p>
                <CodeBlock language="bash" code={`~/.claude/settings.json`} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Windows</p>
                <CodeBlock language="powershell" code={`%USERPROFILE%\\.claude\\settings.json`} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>2. 添加配置内容</h4>
            <p>
              将以下配置复制到{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                settings.json
              </code>{" "}
              文件中：
            </p>
            <CodeBlock
              language="json"
              code={`{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key-here",
    "ANTHROPIC_BASE_URL": "${resolvedOrigin}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": 1
  },
  "permissions": {
    "allow": [],
    "deny": []
  },
  "apiKeyHelper": "echo 'your-api-key-here'"
}`}
            />
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>3. 替换 API 密钥</h4>
            <blockquote className="space-y-2 rounded-lg border-l-2 border-primary/50 bg-muted/40 px-4 py-3">
              <p className="font-semibold text-foreground">重要</p>
              <p>
                请将配置中的{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  your-api-key-here
                </code>{" "}
                替换为您的实际 API 密钥。
              </p>
              <p>密钥获取方式：登录控制台 → API 密钥管理 → 创建 / 查看密钥。</p>
            </blockquote>
          </div>
        </div>

        <div className="space-y-4">
          <h3 id="step-3-start" className={headingClasses.h3}>
            第三步：开始使用
          </h3>
          <ol className="list-decimal space-y-2 pl-6">
            <li>打开终端 / 命令行</li>
            <li>进入您的项目目录</li>
            <li>输入以下命令启动 Claude Code：</li>
          </ol>
          <CodeBlock language="bash" code={`claude`} />
          <p>现在您可以开始使用 Claude Code 辅助开发了！</p>
        </div>

        <div className="space-y-4">
          <h3 id="droid-quickstart" className={headingClasses.h3}>
            🤖 Droid 快速开始（兼容 Codex）
          </h3>

          <p>
            Droid 是 Factory AI 开发的交互式终端 AI 编程助手，支持通过 Claude Code Hub
            代理服务使用。 本指南将帮助你在 5 分钟内完成 Droid 的安装和配置。
          </p>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>安装 Droid</h4>

            <p className="font-semibold text-foreground">macOS / Linux</p>
            <CodeBlock language="bash" code={`curl -fsSL https://app.factory.ai/cli | sh`} />

            <p className="font-semibold text-foreground">Windows</p>
            <CodeBlock
              language="powershell"
              code={`irm https://app.factory.ai/cli/windows | iex`}
            />

            <blockquote className="space-y-1 rounded-lg border-l-2 border-primary/50 bg-muted/40 px-4 py-3">
              <p className="font-semibold text-foreground">提示</p>
              <p>
                Linux 用户需确保已安装{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  xdg-utils
                </code>
                ：
              </p>
              <CodeBlock language="bash" code={`sudo apt-get install xdg-utils`} />
            </blockquote>
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>启动 Droid</h4>
            <p>在项目目录下运行：</p>
            <CodeBlock
              language="bash"
              code={`cd /path/to/your/project
droid`}
            />
            <p>首次启动时，按提示通过浏览器登录 Factory 账号。</p>
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>基本使用</h4>
            <p>启动后，你可以直接与 Droid 对话：</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                分析代码：
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  analyze this codebase and explain the overall architecture
                </code>
              </li>
              <li>
                修改代码：
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  add comprehensive logging to the main application startup
                </code>
              </li>
              <li>
                安全审计：
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  audit this codebase for security vulnerabilities
                </code>
              </li>
              <li>
                Git 操作：
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  review my uncommitted changes and suggest improvements
                </code>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>常用快捷键</h4>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Enter</strong>: 发送消息
              </li>
              <li>
                <strong>Shift+Enter</strong>: 多行输入
              </li>
              <li>
                <strong>Shift+Tab</strong>: 切换模式
              </li>
              <li>
                <strong>?</strong>: 查看所有快捷键
              </li>
              <li>
                <strong>Ctrl+C</strong> 或输入{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">exit</code>:
                退出
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <h3 id="droid-cch-config" className={headingClasses.h3}>
            🔗 Droid 使用 Claude Code Hub 接入
          </h3>

          <p>配置 Droid 连接到 Claude Code Hub 代理服务，使用自己的 API 密钥。</p>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>1. 注册并登录 Droid</h4>
            <ol className="list-decimal space-y-2 pl-6">
              <li>下载并安装 Droid（参考上一节）</li>
              <li>
                运行{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">droid</code>{" "}
                命令
              </li>
              <li>按提示注册并登录 Factory 账号</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>2. 配置自定义模型</h4>
            <p>在配置文件中添加 Claude Code Hub 的模型配置：</p>

            <p className="font-semibold text-foreground">配置文件路径</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                macOS / Linux:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  ~/.factory/config.json
                </code>
              </li>
              <li>
                Windows:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  %USERPROFILE%\.factory\config.json
                </code>
              </li>
            </ul>

            <p className="font-semibold text-foreground mt-3">配置内容</p>
            <CodeBlock
              language="json"
              code={`{
  "custom_models": [
    {
      "model_display_name": "Sonnet 4.5 [CCH]",
      "model": "claude-sonnet-4-5-20250929",
      "base_url": "${resolvedOrigin}",
      "api_key": "your-api-key-here",
      "provider": "anthropic"
    },
    {
      "model_display_name": "GPT-5-Codex [CCH]",
      "model": "gpt-5-codex",
      "base_url": "${resolvedOrigin}/v1",
      "api_key": "your-api-key-here",
      "provider": "openai"
    }
  ]
}`}
            />
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>3. 替换 API 密钥</h4>
            <blockquote className="space-y-2 rounded-lg border-l-2 border-primary/50 bg-muted/40 px-4 py-3">
              <p className="font-semibold text-foreground">重要</p>
              <p>
                将{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  your-api-key-here
                </code>{" "}
                替换为你在 Claude Code Hub 控制台创建的 API 密钥。
              </p>
              <p>密钥获取：登录控制台 → 设置 → API 密钥管理 → 创建密钥</p>
            </blockquote>
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>4. 选择模型</h4>
            <ol className="list-decimal space-y-2 pl-6">
              <li>重启 Droid</li>
              <li>
                输入{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">/model</code>{" "}
                命令
              </li>
              <li>
                选择 <strong>GPT-5-Codex [CCH]</strong> 或 <strong>Sonnet 4.5 [CCH]</strong>
              </li>
              <li>开始使用！</li>
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <h3 id="codex-cli-windows" className={headingClasses.h3}>
            💻 Codex CLI Windows 部署指南
          </h3>

          <p>Codex CLI 是 OpenAI 官方的命令行 AI 编程助手，支持通过 Claude Code Hub 代理使用。</p>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>一、安装 Node.js 环境</h4>

            <p className="font-semibold text-foreground">方法一：官网下载（推荐）</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                访问{" "}
                <a
                  href="https://nodejs.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline"
                >
                  https://nodejs.org/
                </a>
              </li>
              <li>下载 LTS 版本（需 v18 或更高）</li>
              <li>双击 .msi 文件，按向导安装</li>
              <li>验证安装：</li>
            </ol>
            <CodeBlock
              language="powershell"
              code={`node --version
npm --version`}
            />

            <p className="font-semibold text-foreground">方法二：使用包管理器</p>
            <CodeBlock
              language="powershell"
              code={`# 使用 Chocolatey
choco install nodejs

# 或使用 Scoop
scoop install nodejs`}
            />
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>二、安装 Codex CLI</h4>
            <p>以管理员身份运行 PowerShell，执行：</p>
            <CodeBlock
              language="powershell"
              code={`npm i -g @openai/codex --registry=https://registry.npmmirror.com`}
            />
            <p>验证安装：</p>
            <CodeBlock language="powershell" code={`codex --version`} />
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>三、配置 Codex 环境</h4>

            <p className="font-semibold text-foreground">方法一：编辑配置文件（推荐）</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                打开文件资源管理器，找到{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  C:\Users\你的用户名\.codex
                </code>{" "}
                文件夹（不存在则创建）
              </li>
              <li>
                创建{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  config.toml
                </code>{" "}
                文件
              </li>
              <li>使用 Notepad 打开，添加以下内容：</li>
            </ol>
            <CodeBlock
              language="toml"
              code={`model_provider = "claude_code_hub"
model = "gpt-5-codex"
model_reasoning_effort = "high"
disable_response_storage = true
sandbox_mode = "workspace-write"
windows_wsl_setup_acknowledged = true

[features]
plan_tool = true
apply_patch_freeform = true
view_image_tool = true
web_search_request = true
unified_exec = false
streamable_shell = false
rmcp_client = true

[tools]
web_search = true
view_image = true

[model_providers.claude_code_hub]
name = "claude_code_hub"
base_url = "${resolvedOrigin}/v1"
wire_api = "responses"
env_key = "CCH_API_KEY"
requires_openai_auth = true

[sandbox_workspace_write]
network_access = true`}
            />

            <ol className="list-decimal space-y-2 pl-6" start={4}>
              <li>
                创建{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  auth.json
                </code>{" "}
                文件，添加：
              </li>
            </ol>
            <CodeBlock
              language="json"
              code={`{
  "OPENAI_API_KEY": "your-api-key-here"
}`}
            />

            <p className="font-semibold text-foreground mt-4">方法二：设置环境变量</p>
            <p>在 PowerShell 中运行：</p>
            <CodeBlock
              language="powershell"
              code={`[System.Environment]::SetEnvironmentVariable("CCH_API_KEY", "your-api-key-here", [System.EnvironmentVariableTarget]::User)`}
            />

            <blockquote className="space-y-2 rounded-lg border-l-2 border-primary/50 bg-muted/40 px-4 py-3">
              <p className="font-semibold text-foreground">重要提示</p>
              <ul className="list-disc space-y-2 pl-4">
                <li>
                  将{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                    your-api-key-here
                  </code>{" "}
                  替换为你的 Claude Code Hub API 密钥
                </li>
                <li>使用与 Claude Code 相同的密钥体系</li>
                <li>设置环境变量后需重新打开 PowerShell 窗口</li>
              </ul>
            </blockquote>
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>四、开始使用 Codex</h4>
            <p>在项目目录下运行：</p>
            <CodeBlock
              language="powershell"
              code={`cd C:\path\to\your\project
codex`}
            />
          </div>

          <div className="space-y-3">
            <h4 className={headingClasses.h4}>五、常见问题</h4>

            <p className="font-semibold text-foreground">1. 命令未找到</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                确保 npm 全局路径（通常是{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                  C:\Users\你的用户名\AppData\Roaming\npm
                </code>
                ）已添加到系统 PATH
              </li>
              <li>重新打开 PowerShell 窗口</li>
            </ul>

            <p className="font-semibold text-foreground">2. API 连接失败</p>
            <CodeBlock
              language="powershell"
              code={`# 检查环境变量
echo $env:CCH_API_KEY

# 测试网络连接
Test-NetConnection -ComputerName ${resolvedOrigin.replace("https://", "").replace("http://", "")} -Port 443`}
            />

            <p className="font-semibold text-foreground">3. 更新 Codex</p>
            <CodeBlock
              language="powershell"
              code={`npm i -g @openai/codex --registry=https://registry.npmmirror.com`}
            />
          </div>
        </div>
      </section>

      <hr className="border-border/60" />

      <section className="space-y-4">
        <h2 id="common-commands" className={headingClasses.h2}>
          📚 常用命令
        </h2>
        <p>启动 Claude Code 后，您可以使用以下常用命令：</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">/help</code> -
            查看帮助信息
          </li>
          <li>
            <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">/clear</code> -
            清空对话历史，并开启新的对话
          </li>
          <li>
            <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">/compact</code> -
            总结当前对话
          </li>
          <li>
            <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">/cost</code> -
            查看当前对话已经使用的金额
          </li>
          <li>
            ... 其他更多命令查看
            <a
              href="https://docs.claude.com/zh-CN/docs/claude-code/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
            >
              官方文档
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 id="troubleshooting" className={headingClasses.h2}>
          🔍 故障排查
        </h2>
        <h3 className={headingClasses.h3}>常见问题</h3>

        <div className="space-y-3">
          <p className="font-semibold text-foreground">1. 安装失败</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>检查网络连接是否正常</li>
            <li>确保有管理员权限（Windows）或使用 sudo（macOS / Linux）</li>
            <li>尝试使用代理或镜像源</li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="font-semibold text-foreground">2. API 密钥无效</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>确认密钥已正确复制（无多余空格）</li>
            <li>检查密钥是否在有效期内</li>
            <li>验证账户权限是否正常</li>
          </ul>
        </div>
      </section>
    </article>
  );
}

/**
 * 文档页面
 * 使用客户端组件渲染静态文档内容，并提供目录导航
 */
export default function UsageDocPage() {
  const [activeId, setActiveId] = useState<string>("");
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocReady, setTocReady] = useState(false);
  const [serviceOrigin, setServiceOrigin] = useState(
    () => (typeof window !== "undefined" && window.location.origin) || ""
  );

  useEffect(() => {
    setServiceOrigin(window.location.origin);
  }, []);

  // 生成目录并监听滚动
  useEffect(() => {
    // 获取所有标题
    const headings = document.querySelectorAll("h2, h3");
    const items: TocItem[] = [];

    headings.forEach((heading) => {
      // 为标题添加 id（如果没有的话）
      if (!heading.id) {
        heading.id = heading.textContent?.toLowerCase().replace(/\s+/g, "-") || "";
      }

      items.push({
        id: heading.id,
        text: heading.textContent || "",
        level: parseInt(heading.tagName[1]),
      });
    });

    setTocItems(items);
    setTocReady(true);

    // 监听滚动，高亮当前章节
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (const item of items) {
        const element = document.getElementById(item.id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveId(item.id);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // 初始化

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 点击目录项滚动到对应位置
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offsetTop = element.offsetTop - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative flex gap-8">
      {/* 左侧主文档 */}
      <div className="flex-1">
        {/* 文档容器 */}
        <div className="relative bg-card rounded-xl shadow-sm border p-8 md:p-12">
          {/* 文档内容 */}
          <UsageDocContent origin={serviceOrigin} />
        </div>
      </div>

      {/* 右侧目录导航 */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 space-y-4">
          <div className="bg-card rounded-lg border p-4">
            <h4 className="font-semibold text-sm mb-3">本页导航</h4>
            <nav className="space-y-1">
              {!tocReady && (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-5 w-full" />
                  ))}
                </div>
              )}
              {tocReady && tocItems.length === 0 && (
                <p className="text-xs text-muted-foreground">本页暂无可用章节</p>
              )}
              {tocReady &&
                tocItems.length > 0 &&
                tocItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      "block w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors",
                      item.level === 3 && "pl-6 text-xs",
                      activeId === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {item.text}
                  </button>
                ))}
            </nav>
          </div>

          {/* 快速操作 */}
          <div className="bg-card rounded-lg border p-4">
            <h4 className="font-semibold text-sm mb-3">快速链接</h4>
            <div className="space-y-2">
              <a
                href="/dashboard"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                返回仪表盘
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                回到顶部
              </a>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
