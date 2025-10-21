import { Hono } from "hono";
import { handle } from "hono/vercel";
import { handleProxyRequest } from "@/app/v1/_lib/proxy-handler";
import { handleChatCompletions } from "@/app/v1/_lib/codex/chat-completions-handler";

export const runtime = "nodejs";

const app = new Hono().basePath("/v1");

// OpenAI Compatible API 路由（优先匹配）
app.post("/chat/completions", handleChatCompletions);

// Claude API 和其他所有请求（fallback）
app.all("*", handleProxyRequest);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
