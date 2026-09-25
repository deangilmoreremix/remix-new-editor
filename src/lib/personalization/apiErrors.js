export function personalizationApiError(response, payload = {}, fallback = 'SmartVideo personalization request failed.') {
  const status = Number(response?.status || 0);
  const backendMessage = payload?.message || payload?.error;

  if (status === 401) {
    return new Error('Your SmartVideo session expired. Sign in again, then retry.');
  }
  if (status === 403) {
    return new Error('Your account is not authorized to use this SmartVideo personalization feature.');
  }
  if (status === 429) {
    return new Error('SmartVideo personalization is temporarily rate-limited. Wait a moment, then retry.');
  }

  return new Error(backendMessage || (status ? `${fallback} (${status})` : fallback));
}
