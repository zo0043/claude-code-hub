/**
 * OpenAI Compatible API (/v1/chat/completions) 类型定义
 */

// ============ 请求类型 ============

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;

  // 以下参数将被丢弃（Codex 仅支持 reasoning）
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  stop?: string | string[];
  n?: number;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
  name?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: ImageURL;
}

export interface ImageURL {
  url: string;
  detail?: 'low' | 'high' | 'auto';
}

// ============ 响应类型（非流式）============

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string | null;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  logprobs?: null;
}

// ============ 响应类型（流式）============

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChunkChoice[];
  system_fingerprint?: string | null;
}

export interface ChunkChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
  };
  finish_reason: 'stop' | 'length' | null;
  logprobs?: null;
}
