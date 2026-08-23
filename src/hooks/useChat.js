import { useEffect, useCallback, useRef } from 'react';
import { chatStore } from '../lib/chatStore.js';
import { chatApi } from '../lib/chatApi.js';
import { loadAllConversations, saveConversation, setActiveConversationId, getActiveConversationId } from '../lib/chatPersistence.js';

export function useChat() {
  const mountedRef = useRef(true);

  useEffect(() => {
    (async () => {
      const convs = await loadAllConversations();
      if (!mountedRef.current) return;
      chatStore.setConversations(convs);
      const activeId = await getActiveConversationId();
      if (activeId) chatStore.setActiveConversationId(activeId);
    })();
    return () => { mountedRef.current = false; };
  }, []);

  const createConversation = useCallback(async () => {
    const conv = await chatApi.createConversation();
    chatStore.setConversations([...chatStore.conversations, conv]);
    chatStore.setActiveConversationId(conv.id);
    await setActiveConversationId(conv.id);
    await saveConversation(conv);
    return conv;
  }, []);

  const switchConversation = useCallback(async (id) => {
    chatStore.setActiveConversationId(id);
    await setActiveConversationId(id);
  }, []);

  const deleteConversation = useCallback(async (id) => {
    chatStore.setConversations(chatStore.conversations.filter(c => c.id !== id));
    if (chatStore.activeConversationId === id) {
      chatStore.setActiveConversationId(null);
      await setActiveConversationId(null);
    }
    try {
      const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
      if (!base) throw new Error('VITE_BACKEND_URL not configured');
      await fetch(`${base}/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('Failed to delete conversation on backend:', e.message);
    }
  }, []);

  const sendMessage = useCallback(async (content, model, systemPrompt, temperature, maxTokens) => {
    if (!content.trim() || chatStore.isStreaming) return;

    const userMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content,
      status: 'complete',
      createdAt: Date.now(),
    };
    chatStore.addMessage(userMessage);

    const assistantMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
    };
    chatStore.addMessage(assistantMessage);
    chatStore.setStreaming(true);
    chatStore.setError(null);

    try {
      await chatApi.sendChatMessage({
        conversationId: chatStore.activeConversationId,
        messages: [...chatStore.activeMessages],
        model,
        systemPrompt,
        temperature,
        maxTokens,
        onDelta: (delta) => {
          chatStore.updateMessage(assistantMessage.id, { content: assistantMessage.content + delta });
        },
        onDone: async (fullText) => {
          chatStore.updateMessage(assistantMessage.id, { content: fullText, status: 'complete' });
          chatStore.setStreaming(false);
          if (chatStore.activeConversation) {
            chatStore.activeConversation.updatedAt = Date.now();
            await saveConversation(chatStore.activeConversation);
          }
        },
        onError: (error) => {
          chatStore.updateMessage(assistantMessage.id, { status: 'error' });
          chatStore.setStreaming(false);
          chatStore.setError(error.message);
        },
      });
    } catch (error) {
      chatStore.updateMessage(assistantMessage.id, { status: 'error' });
      chatStore.setStreaming(false);
      chatStore.setError(error.message);
    }
  }, []);

  const stopGeneration = useCallback(() => {
    chatStore.setStreaming(false);
    const lastMsg = chatStore.activeMessages[chatStore.activeMessages.length - 1];
    if (lastMsg && lastMsg.status === 'streaming') {
      chatStore.updateMessage(lastMsg.id, { status: 'cancelled' });
    }
  }, []);

  return {
    ...chatStore,
    createConversation,
    switchConversation,
    deleteConversation,
    sendMessage,
    stopGeneration,
  };
}
