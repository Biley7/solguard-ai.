const DEFAULT_ATTEMPTS = 2;
const DEFAULT_BASE_DELAY_MS = 200;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Retries a read-only RPC operation a bounded number of times.
 * Transaction simulation, signing, submission, and confirmation never use this helper.
 */
export async function retryRead(operation, {
  attempts = DEFAULT_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
} = {}) {
  if (typeof operation !== 'function') throw new TypeError('A read operation is required.');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new RangeError('Read retry attempts must be an integer between 1 and 3.');
  }
  if (!Number.isInteger(baseDelayMs) || baseDelayMs < 0 || baseDelayMs > 2_000) {
    throw new RangeError('Read retry delay must be between 0 and 2000 milliseconds.');
  }

  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await wait(baseDelayMs * (2 ** attempt));
    }
  }
  throw lastError;
}
