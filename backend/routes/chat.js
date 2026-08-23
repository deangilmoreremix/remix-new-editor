import { Router } from 'express';
import ChatDb from '../db/chatDb.js';
import { chatAuth } from '../middleware/chatAuth.js';

const router = Router();

router.get('/conversations', chatAuth, (req, res) => {
  const userId = req.chatUserId || 'anonymous';
  res.json({ conversations: ChatDb.listConversations(userId) });
});

router.post('/conversations', chatAuth, (req, res) => {
  const userId = req.chatUserId || 'anonymous';
  const conv = ChatDb.createConversation(userId, req.body || {});
  res.status(201).json({ conversation: conv });
});

router.get('/conversations/:id', chatAuth, (req, res) => {
  const conv = ChatDb.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json({ conversation: { ...conv, messages: ChatDb.getMessages(req.params.id) } });
});

router.delete('/conversations/:id', chatAuth, (req, res) => {
  ChatDb.deleteConversation(req.params.id);
  res.json({ ok: true });
});

router.post('/conversations/:id/messages', chatAuth, (req, res) => {
  const msg = ChatDb.addMessage(req.params.id, req.body || {});
  res.status(201).json({ message: msg });
});

export default router;
