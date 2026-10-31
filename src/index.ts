export type RetryContext = Readonly<{ attempt: number; elapsedMs: number }>;
export type RetryPolicy = (error: unknown, context: RetryContext) => boolean;
export type JitterMode = 'none' | 'full' | 'equal';

export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: JitterMode;
  shouldRetry?: RetryPolicy;
  signal?: AbortSignal;
  random?: () => number;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  onRetry?: (error: unknown, context: RetryContext & { delayMs: number }) => void;
}

export class RetryAbortedError extends Error {
  override name = 'RetryAbortedError';
  constructor(message = 'Retry operation was aborted', options?: ErrorOptions) {
    super(message, options);
  }
}

export function abortableSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds < 0)
    throw new RangeError('milliseconds must be a non-negative finite number');
  if (signal?.aborted)
    return Promise.reject(
      new RetryAbortedError('Retry operation was aborted', { cause: signal.reason }),
    );
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new RetryAbortedError('Retry operation was aborted', { cause: signal?.reason }));
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export async function retry<T>(
  operation: (context: RetryContext) => T | Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const minDelayMs = options.minDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? 'none';
  for (const [name, value] of [
    ['retries', retries],
    ['minDelayMs', minDelayMs],
    ['maxDelayMs', maxDelayMs],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || (name === 'retries' && !Number.isInteger(value)))
      throw new RangeError(
        `${name} must be a non-negative ${name === 'retries' ? 'integer' : 'finite number'}`,
      );
  }
  if (factor < 1 || !Number.isFinite(factor))
    throw new RangeError('factor must be a finite number at least 1');
  if (maxDelayMs < minDelayMs) throw new RangeError('maxDelayMs must be at least minDelayMs');
  if (!['none', 'full', 'equal'].includes(jitter))
    throw new RangeError('jitter must be none, full, or equal');
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? abortableSleep;
  const startedAt = Date.now();
  let attempt = 0;
  for (;;) {
    if (options.signal?.aborted)
      throw new RetryAbortedError('Retry operation was aborted', { cause: options.signal.reason });
    try {
      return await operation({ attempt, elapsedMs: Date.now() - startedAt });
    } catch (error) {
      const context = { attempt, elapsedMs: Date.now() - startedAt };
      if (attempt >= retries || options.shouldRetry?.(error, context) === false) throw error;
      const ceiling = Math.min(maxDelayMs, minDelayMs * factor ** attempt);
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample > 1)
        throw new RangeError('random must return a number from 0 to 1');
      const delayMs =
        jitter === 'full'
          ? ceiling * sample
          : jitter === 'equal'
            ? ceiling / 2 + (ceiling / 2) * sample
            : ceiling;
      options.onRetry?.(error, { ...context, delayMs });
      await sleep(delayMs, options.signal);
      attempt += 1;
    }
  }
}
