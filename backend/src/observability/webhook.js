export async function postWebhook({
  url,
  token = '',
  payload,
  fetchImpl = fetch,
  timeoutMs = 5_000,
}) {
  if (!url) throw new Error('Webhook URL is not configured.');

  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const error = new Error('Webhook rejected the payload.');
    error.code = `WEBHOOK_HTTP_${response.status}`;
    throw error;
  }
}
