/**
 * 请求转换器: OpenAI Compatible API → Response API
 * 纯函数实现，无副作用
 */

import type {
  ChatCompletionRequest,
  ChatMessage,
  ContentPart,
} from '../types/compatible';
import type {
  ResponseRequest,
  InputItem,
  ContentItem,
  MessageInput,
} from '../types/response';

export class RequestTransformer {
  /**
   * 转换 Compatible 请求为 Response 请求
   */
  static transform(request: ChatCompletionRequest): ResponseRequest {
    return {
      model: request.model,
      input: this.transformMessages(request.messages),
      reasoning: this.extractReasoning(),
      stream: request.stream,
    };
  }

  /**
   * 转换 messages 数组为 input 数组
   */
  private static transformMessages(messages: ChatMessage[]): InputItem[] {
    return messages.map((msg) => this.transformMessage(msg));
  }

  /**
   * 转换单个 message
   * 关键: system role → developer role
   */
  private static transformMessage(message: ChatMessage): MessageInput {
    const role = message.role === 'system' ? 'developer' : message.role;
    return {
      role: role,
      content: this.transformContent(message.content, role),
    };
  }

  /**
   * 转换 content（支持字符串和多模态数组）
   * 根据角色选择正确的 content type:
   * - assistant → output_text
   * - user/developer → input_text
   */
  private static transformContent(
    content: string | ContentPart[],
    role: 'user' | 'assistant' | 'developer'
  ): ContentItem[] {
    // 字符串 → [{ type: 'input_text' | 'output_text', text }]
    if (typeof content === 'string') {
      return [
        {
          type: role === 'assistant' ? 'output_text' : 'input_text',
          text: content,
        },
      ];
    }

    // ContentPart[] → ContentItem[]
    return content.map((part) => this.transformContentPart(part, role));
  }

  /**
   * 转换单个 content part
   * 关键:
   * - text → input_text (user/developer) 或 output_text (assistant)
   * - image_url → input_image (总是 input，不管角色)
   */
  private static transformContentPart(
    part: ContentPart,
    role: 'user' | 'assistant' | 'developer'
  ): ContentItem {
    if (part.type === 'text') {
      return {
        type: role === 'assistant' ? 'output_text' : 'input_text',
        text: part.text!,
      };
    } else {
      // image_url → input_image（图片总是 input）
      return {
        type: 'input_image',
        image_url: part.image_url!.url,
      };
    }
  }

  /**
   * 提取 reasoning 配置
   * 默认使用 medium effort 和 auto summary
   */
  private static extractReasoning() {
    return {
      effort: 'medium' as const,
      summary: 'auto' as const,
    };
  }
}
