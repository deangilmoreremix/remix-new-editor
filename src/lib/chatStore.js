import { makeAutoObservable } from 'mobx';
import { MessageRole, MessageStatus } from '../types/chat.js';

class ChatStore {
  conversations = [];
  activeConversationId = null;
  isStreaming = false;
  isGenerating = false;
  error = null;
  selectedModelId = null;

  constructor() {
    makeAutoObservable(this);
  }

  get activeConversation() {
    return this.conversations.find(c => c.id === this.activeConversationId) || null;
  }

  get activeMessages() {
    return this.activeConversation?.messages || [];
  }

  setConversations(convs) { this.conversations = convs; }
  setActiveConversationId(id) { this.activeConversationId = id; }
  setStreaming(val) { this.isStreaming = val; }
  setGenerating(val) { this.isGenerating = val; }
  setError(err) { this.error = err; }
  setSelectedModelId(id) { this.selectedModelId = id; }

  addMessage(message) {
    if (!this.activeConversation) return;
    this.activeConversation.messages.push(message);
  }

  updateMessage(id, updates) {
    const msg = this.activeMessages.find(m => m.id === id);
    if (msg) Object.assign(msg, updates);
  }

  removeMessage(id) {
    if (!this.activeConversation) return;
    this.activeConversation.messages = this.activeMessages.filter(m => m.id !== id);
  }
}

export const chatStore = new ChatStore();
export default chatStore;
