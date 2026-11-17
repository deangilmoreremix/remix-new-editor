import { createHash } from 'node:crypto'

/**
 * OpenAI's `safety_identifier`: a stable, privacy-preserving id for the end user (128 chars or fewer).
 * It is a salted SHA-256 of the signed-in user's id, so OpenAI can attribute abuse to one account without ever
 * receiving the real id, an email or a name.
 */
export function safetyIdentifier(userId: string): string {
  const salt = process.env.OPENAI_SAFETY_SALT || process.env.INTERNAL_FUNCTION_SECRET || 'smartvid-personalization'
  return createHash('sha256').update(`${salt}:${userId}`).digest('hex')
}
