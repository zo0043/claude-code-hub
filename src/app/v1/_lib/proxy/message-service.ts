import { createMessageRequest } from "@/repository/message";
import type { ProxySession } from "./session";

export class ProxyMessageService {
  static async ensureContext(session: ProxySession): Promise<void> {
    const authState = session.authState;
    const provider = session.provider;

    if (!authState || !authState.success || !authState.user || !authState.key || !authState.apiKey || !provider) {
      session.setMessageContext(null);
      return;
    }

    const messageRequest = await createMessageRequest({
      provider_id: provider.id,
      user_id: authState.user.id,
      key: authState.apiKey,
      model: session.request.model ?? undefined,
      session_id: session.sessionId ?? undefined,  // 新增：传入 session_id
    });

    session.setMessageContext({
      id: messageRequest.id,
      user: authState.user,
      key: authState.key,
      apiKey: authState.apiKey
    });
  }
}
