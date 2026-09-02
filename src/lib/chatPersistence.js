import { get, set, del, keys } from 'idb-keyval';

const CONVERSATIONS_KEY = 'chat_conversations';
const ACTIVE_KEY = 'chat_active_conversation_id';

export async function loadAllConversations() {
  const raw = await get(CONVERSATIONS_KEY);
  return raw || [];
}

export async function saveConversation(conversation) {
  const all = await loadAllConversations();
  const idx = all.findIndex(c => c.id === conversation.id);
  if (idx >= 0) all[idx] = conversation; else all.push(conversation);
  await set(CONVERSATIONS_KEY, all);
}

export async function deleteConversation(id) {
  const all = (await loadAllConversations()).filter(c => c.id !== id);
  await set(CONVERSATIONS_KEY, all);
  if (await get(ACTIVE_KEY) === id) await del(ACTIVE_KEY);
}

export async function getActiveConversationId() {
  return await get(ACTIVE_KEY) || null;
}

export async function setActiveConversationId(id) {
  if (id) await set(ACTIVE_KEY, id); else await del(ACTIVE_KEY);
}
