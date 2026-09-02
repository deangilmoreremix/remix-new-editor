import { optionalAuth } from './auth.js';

export function chatAuth(req, res, next) {
  optionalAuth(req, res, () => {
    req.chatUserId = req.user?.id || null;
    next();
  });
}
