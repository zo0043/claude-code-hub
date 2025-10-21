/**
 * 流式转换器: Response API SSE → Compatible API Chunks
 * 有状态的转换器，需要维护元数据和 <think> 标签状态
 */

import type { ChatCompletionChunk } from '../types/compatible';
import type {
  SSEEvent,
  ResponseCreatedEvent,
  OutputTextDeltaEvent,
  ResponseCompletedEvent,
  ReasoningSummaryTextDeltaEvent,
  ReasoningSummaryTextDoneEvent,
  ReasoningSummaryPartDoneEvent,
} from '../types/response';

export class StreamTransformer {
  private chunkId: string = '';
  private created: number = Math.floor(Date.now() / 1000); // Unix 秒时间戳
  private model: string = 'gpt-5';

  // 状态追踪：用于 reasoning 标签包装
  private isInReasoning: boolean = false;
  private reasoningItemsWithOutput: Set<string> = new Set();

  /**
   * 转换 SSE 事件为 Compatible Chunk
   * 返回 null 表示跳过该事件
   * 返回数组表示需要发送多个 chunk（如在 completed 时关闭 think 标签）
   */
  transform(
    event: SSEEvent
  ): ChatCompletionChunk | ChatCompletionChunk[] | null {
    // 懒初始化：从任何事件中提取 ID
    if (!this.chunkId && (event.data as any)?.item_id) {
      this.chunkId = this.convertItemId((event.data as any).item_id);
    }

    switch (event.event) {
      case 'response.created':
        return this.handleCreated(event.data as ResponseCreatedEvent);

      case 'response.output_text.delta':
        return this.handleTextDelta(event.data as OutputTextDeltaEvent);

      case 'response.reasoning_summary_text.delta':
        return this.handleReasoningDelta(
          event.data as ReasoningSummaryTextDeltaEvent
        );

      case 'response.reasoning_summary_text.done':
        return this.handleReasoningDone(
          event.data as ReasoningSummaryTextDoneEvent
        );

      case 'response.reasoning_summary_part.done':
        return this.handleReasoningPartDone(
          event.data as ReasoningSummaryPartDoneEvent
        );

      case 'response.completed':
        return this.handleCompleted(event.data as ResponseCompletedEvent);

      case 'response.failed':
        this.resetAfterCompletion();
        return null;

      default:
        // 忽略其他事件
        return null;
    }
  }

  /**
   * 处理 response.created 事件
   * 返回包含 role 的第一个 chunk
   */
  private handleCreated(data: ResponseCreatedEvent): ChatCompletionChunk {
    // 保存元数据
    this.chunkId = this.convertId(data.id);
    this.created = data.created;
    this.model = data.model;

    return {
      id: this.chunkId,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [
        {
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null,
        },
      ],
    };
  }

  /**
   * 处理 response.output_text.delta 事件
   * 返回包含文本增量的 chunk
   * 根据 item_id 前缀判断是否需要添加 <think> 标签
   */
  private handleTextDelta(data: OutputTextDeltaEvent): ChatCompletionChunk {
    const itemId = data.item_id || '';
    return this.emitContentDelta(itemId, data.delta, 'message');
  }

  /**
   * 处理 reasoning summary 的增量事件
   */
  private handleReasoningDelta(
    data: ReasoningSummaryTextDeltaEvent
  ): ChatCompletionChunk {
    const itemId = data.item_id || '';
    return this.emitContentDelta(itemId, data.delta, 'reasoning');
  }

  /**
   * 处理 reasoning summary 的完成事件（可能只有最终文本）
   */
  private handleReasoningDone(
    data: ReasoningSummaryTextDoneEvent
  ): ChatCompletionChunk | null {
    const itemId = data.item_id || '';
    if (!data.text) {
      return null;
    }
    if (itemId && this.reasoningItemsWithOutput.has(itemId)) {
      return null;
    }
    return this.emitContentDelta(itemId, data.text, 'reasoning');
  }

  /**
   * 处理 reasoning summary part 完成事件（部分文本）
   */
  private handleReasoningPartDone(
    data: ReasoningSummaryPartDoneEvent
  ): ChatCompletionChunk | null {
    const itemId = data.item_id || '';
    const text = data.part?.text;
    if (!text) {
      return null;
    }
    if (itemId && this.reasoningItemsWithOutput.has(itemId)) {
      return null;
    }
    return this.emitContentDelta(itemId, text, 'reasoning');
  }

  /**
   * 处理 response.completed 事件
   * 返回结束 chunk
   * 如果还在 reasoning 中（没有 message），需要先关闭 </think> 标签
   */
  private handleCompleted(
    data: ResponseCompletedEvent
  ): ChatCompletionChunk | ChatCompletionChunk[] {
    const chunks: ChatCompletionChunk[] = [];

    // 如果还在 reasoning 中（只有思考没有回复），先关闭标签
    if (this.isInReasoning) {
      chunks.push({
        id: this.chunkId,
        object: 'chat.completion.chunk',
        created: this.created,
        model: this.model,
        choices: [
          {
            index: 0,
            delta: { content: '</think>' },
            finish_reason: null,
          },
        ],
      });
      this.isInReasoning = false;
    }

    // 添加结束 chunk
    const endChunk: ChatCompletionChunk = {
      id: this.chunkId,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
    chunks.push(endChunk);

    const result = chunks.length === 1 ? chunks[0] : chunks;
    this.resetAfterCompletion();
    return result;
  }

  private emitContentDelta(
    rawItemId: string,
    delta: string,
    source: 'reasoning' | 'message'
  ): ChatCompletionChunk {
    this.ensureChunkMetadata(rawItemId);

    const itemId = rawItemId || '';
    const isReasoning = source === 'reasoning' || itemId.startsWith('rs_');
    const isMessage = source === 'message' || itemId.startsWith('msg_');

    let content = delta;

    if (isReasoning) {
      if (!this.isInReasoning) {
        content = '<think>' + content;
        this.isInReasoning = true;
      }
      if (itemId) {
        this.reasoningItemsWithOutput.add(itemId);
      }
    } else if (isMessage && this.isInReasoning) {
      content = '</think>\n' + content;
      this.isInReasoning = false;
    }

    return {
      id: this.chunkId || 'chatcmpl-unknown',
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [
        {
          index: 0,
          delta: { content },
          finish_reason: null,
        },
      ],
    };
  }

  private ensureChunkMetadata(itemId?: string) {
    if (!this.chunkId) {
      this.chunkId = itemId ? this.convertItemId(itemId) : 'chatcmpl-unknown';
    }
  }

  private resetAfterCompletion() {
    this.isInReasoning = false;
    this.reasoningItemsWithOutput.clear();
    this.chunkId = '';
    this.model = 'gpt-5';
    this.created = Math.floor(Date.now() / 1000);
  }

  /**
   * 转换 ID: resp_xxx → chatcmpl-xxx
   */
  private convertId(id: string): string {
    if (!id) {
      return 'chatcmpl-unknown';
    }
    return id.replace('resp_', 'chatcmpl-');
  }

  /**
   * 从 item_id 生成 chunk ID
   * item_id 格式: msg_xxx 或 rs_xxx → chatcmpl-xxx
   */
  private convertItemId(itemId: string): string {
    if (!itemId) {
      return 'chatcmpl-unknown';
    }
    // 提取 msg_ 或 rs_ 后面的部分
    const id = itemId.replace(/^(msg_|rs_)/, 'chatcmpl-');
    return id;
  }
}
