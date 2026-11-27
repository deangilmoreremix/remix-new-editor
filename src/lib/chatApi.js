import { nanoid } from 'nanoid';
import { muapi } from './muapi.js';
import { MessageRole } from '../types/chat.js';
import { MUAPI_TEXT_MODEL, isOpenAIReasoningModel } from './config/openaiConfig.js';

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
  const resolvedModel = model || MUAPI_TEXT_MODEL;
  // GPT-5/GPT-6 reasoning models reject sampling params.
  const samplingTemperature = isOpenAIReasoningModel(resolvedModel) ? undefined : temperature;

  if (onDelta) {
    await muapi.generateTextStream({
      model: resolvedModel,
      prompt: lastUserMessage.content,
      system_prompt: systemPrompt,
      temperature: samplingTemperature,
      max_tokens: maxTokens,
      messages: apiMessages,
      signal,
      onDelta,
      onDone,
      onError,
    });
  } else {
    const response = await muapi.generateText({
      model: resolvedModel,
      prompt: lastUserMessage.content,
      system_prompt: systemPrompt,
      temperature: samplingTemperature,
      max_tokens: maxTokens,
    });
    return response;
  }
}

export async function createConversation() {
  return {
    id: nanoid(),
    title: 'New conversation',
    model: MUAPI_TEXT_MODEL,
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
