const conversations = new Map();
const messages = new Map();

let seq = 0;
function nextId() { return `c_${Date.now()}_${++seq}`; }

const ChatDb = {
  createConversation(userId, data) {
    const id = nextId();
    const conv = { id, userId, ...data, createdAt: Date.now(), updatedAt: Date.now() };
    conversations.set(id, conv);
    messages.set(id, []);
    return conv;
  },
  getConversation(id) { return conversations.get(id) || null; },
  listConversations(userId) {
    return Array.from(conversations.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  deleteConversation(id) {
    conversations.delete(id);
    messages.delete(id);
  },
  addMessage(conversationId, msg) {
    const list = messages.get(conversationId) || [];
    list.push(msg);
    messages.set(conversationId, list);
    const conv = conversations.get(conversationId);
    if (conv) conv.updatedAt = Date.now();
    return msg;
  },
  getMessages(conversationId) {
    return messages.get(conversationId) || [];
  },
};

export default ChatDb;
