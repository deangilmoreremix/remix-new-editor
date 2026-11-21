// Standalone access-token check for the host server (not upstream). Kept separate so it can be tested on its own.
import crypto from 'node:crypto'

/** decodeURIComponent that returns '' for malformed input instead of throwing (a throw here would crash the process). */
/** @param {string} value */
export const safeDecode = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

/**
 * Build the check used for every request when VIDBEE_ACCESS_TOKEN is set. The token may arrive as
 * `Authorization: Bearer <token>` or in the `vidbee_token` cookie (URL-encoded). Malformed values are rejected, never thrown.
 */
/** @param {string} accessToken */
export const createTokenCheck = (accessToken) => {
  const expected = Buffer.from(accessToken)
  /** @param {{ authorization?: string | string[]; cookie?: string | string[] }} headers */
  return (headers) => {
    const cookie = /(?:^|;\s*)vidbee_token=([^;]+)/.exec(String(headers.cookie ?? ''))?.[1] ?? ''
    const bearer = String(headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    return [bearer, cookie].map(safeDecode).some((given) => {
      const buffer = Buffer.from(given)
      // Compare byte lengths (not string lengths): timingSafeEqual throws when the buffers differ in size.
      return buffer.length === expected.length && crypto.timingSafeEqual(buffer, expected)
    })
  }
}
