/**
 * Security Utilities for XSS Prevention
 * All user inputs must be sanitized before rendering in HTML
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for HTML insertion
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escape HTML in template literals safely
 * @param  {...any} strings - Template literal strings
 * @param  {...any} values - Template literal values
 * @returns {string} - Safe HTML string
 */
export function safeTemplate(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const value = values[i];
    return result + str + (value !== undefined ? escapeHtml(String(value)) : '');
  }, '');
}

/**
 * Sanitize object values for safe HTML rendering
 * @param {Object} obj - Object with string values
 * @returns {Object} - Object with sanitized values
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = escapeHtml(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? escapeHtml(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Validate and sanitize URLs
 * @param {string} url - URL to validate
 * @returns {string|null} - Safe URL or null if invalid
 */
export function sanitizeUrl(url) {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    // Only allow safe protocols
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Strip all HTML tags from string
 * @param {string} str - String to strip
 * @returns {string}
 */
export function stripHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerText || div.textContent;
}

/**
 * Content Security Policy helper
 * Returns CSP meta tag content
 */
export const CSP_POLICY = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  media-src 'self' https:;
  connect-src 'self' https:;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s+/g, ' ').trim();