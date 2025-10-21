/**
 * 响应转换器: Response API → OpenAI Compatible API
 * 纯函数实现，无副作用
 */

import type {
  ChatCompletionResponse,
  ChatCompletionChoice,
} from '../types/compatible';
import type {
  ResponseObject,
  OutputItem,
  ReasoningOutput,
  MessageOutput,
} from '../types/response';

export class ResponseTransformer {
  /**
   * 转换 Response 对象为 Compatible 响应
   */
  static transform(response: ResponseObject): ChatCompletionResponse {
    const thinkingText = this.extractThinking(response.output);
    const mainText = this.extractMainText(response.output);

    // 拼接思考内容: <think>...</think>\n主要内容
    const fullContent = thinkingText
      ? `<think>${thinkingText}</think>\n${mainText}`
      : mainText;

    return {
      id: this.convertId(response.id),
      object: 'chat.completion',
      created: response.created,
      model: response.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: fullContent,
          },
          finish_reason: this.mapFinishReason(response.status),
        },
      ],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
      },
      system_fingerprint: null,
    };
  }

  /**
   * 提取思考内容（reasoning summary）
   */
  private static extractThinking(output: OutputItem[]): string | null {
    const reasoningItem = output.find(
      (item) => item.type === 'reasoning'
    ) as ReasoningOutput | undefined;

    if (!reasoningItem || !reasoningItem.summary) {
      return null;
    }

    // 提取第一个 summary_text
    return reasoningItem.summary[0]?.text || null;
  }

  /**
   * 提取主要文本内容（message output）
   */
  private static extractMainText(output: OutputItem[]): string {
    const messageItem = output.find(
      (item) => item.type === 'message'
    ) as MessageOutput | undefined;

    if (!messageItem) {
      return '';
    }

    // 拼接所有 output_text
    return messageItem.content
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text)
      .join('');
  }

  /**
   * 转换响应 ID: resp_xxx → chatcmpl-xxx
   */
  private static convertId(responseId: string): string {
    return responseId.replace('resp_', 'chatcmpl-');
  }

  /**
   * 映射 finish_reason
   */
  private static mapFinishReason(
    status: ResponseObject['status']
  ): ChatCompletionChoice['finish_reason'] {
    switch (status) {
      case 'completed':
        return 'stop';
      case 'incomplete':
        return 'length';
      default:
        return null;
    }
  }
}
