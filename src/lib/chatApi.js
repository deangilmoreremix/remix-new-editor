import { nanoid } from 'nanoid';
import { muapi } from './muapi.js';
import { MessageRole } from '../types/chat.js';

export async function sendChatMessage({
  conversationId, messages, model, systemPrompt, temperature, maxTokens,
  signal, onDelta, onDone, onError,
}) {
  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: MessageRole.SYSTEM, content: systemPrompt });
  }
  apiMessages.push(...messages.map(m => ({
    role: m.role === MessageRole.USER ? 'user' : 'assistant',
    content: m.content,
  })));

  const lastUserMessage = apiMessages[apiMessages.length - 1];

  if (onDelta) {
    await muapi.generateTextStream({
      model: model || 'gpt-5-mini',
      prompt: lastUserMessage.content,
      system_prompt: systemPrompt,
      temperature,
      max_tokens: maxTokens,
      messages: apiMessages,
      signal,
      onDelta,
      onDone,
      onError,
    });
  } else {
    const response = await muapi.generateText({
      model: model || 'gpt-5-mini',
      prompt: lastUserMessage.content,
      system_prompt: systemPrompt,
      temperature,
      max_tokens: maxTokens,
    });
    return response;
  }
}

export async function createConversation() {
  return {
    id: nanoid(),
    title: 'New conversation',
    model: 'gpt-5-mini',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 1024,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const chatApi = {
  sendChatMessage,
  createConversation,
};
