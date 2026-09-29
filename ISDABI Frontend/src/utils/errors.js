/** Turns any thrown value into a message that is safe and useful to show. */
export function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  if (!err.response) {
    if (err.code === 'ERR_NETWORK' || err.request) return 'Cannot reach the ISDABI server. Check that the backend is running.';
    return err.message && !/status code|axios/i.test(err.message) ? err.message : fallback;
  }
  const { status, data } = err.response;
  const serverMessage = typeof data?.message === 'string' ? data.message : null;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 404) return serverMessage || 'This item could not be found.';
  if (status === 413) return serverMessage || 'This file is too large to upload.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 502 || status === 503 || status === 504) return 'The service is temporarily unavailable. Please try again shortly.';
  if (status >= 500) return serverMessage && serverMessage.length < 140 ? serverMessage : fallback;
  return serverMessage || fallback;
}
