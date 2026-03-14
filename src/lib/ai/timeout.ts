/**
 * Wraps a promise with a timeout — rejects if the promise doesn't resolve within `ms`.
 * Used to prevent individual AI analyst calls from hanging the entire analysis stream.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Retry a function up to `retries` times with a delay between attempts.
 * Used to give AI analysts a second chance if the first call fails/times out.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 1,
  delayMs: number = 500,
  label: string = "operation"
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        console.warn(`${label} attempt ${attempt + 1} failed, retrying in ${delayMs}ms…`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}
