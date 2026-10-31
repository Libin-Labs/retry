# @lp-labs/retry

Retry a promise-producing operation with bounded exponential delay, optional jitter, a retry policy, and `AbortSignal` cancellation. The module uses only Node/browser platform APIs and has no runtime dependencies.

```ts
import { retry } from "@lp-labs/retry";

const response = await retry(() => fetch("https://example.com/data"), {
  retries: 4,
  minDelayMs: 200,
  maxDelayMs: 2_000,
  jitter: "full",
  signal: AbortSignal.timeout(8_000),
  shouldRetry: (error) => !(error instanceof TypeError)
});
```

## API

- `retry<T>(operation, options?) -> Promise<T>` calls `operation` once immediately, then makes up to `retries` additional attempts. Attempt indexes start at zero. It returns the first value or rejects with the final operation error. An exception thrown by `shouldRetry`, `onRetry`, `random`, or `sleep` rejects directly.
- `RetryOptions` fields: `retries` defaults to `3` (non-negative integer); `minDelayMs` defaults to `100`; `maxDelayMs` defaults to `30000`; `factor` defaults to `2` and must be finite and at least one; `jitter` is `"none"` (default), `"full"`, or `"equal"`; `shouldRetry(error, context)` returns whether to retry and defaults to true; `signal` cancels before attempts or during sleep; `random` defaults to `Math.random`; `sleep(milliseconds, signal?)` defaults to `abortableSleep`; `onRetry(error, context)` runs before the wait.
- `JitterMode` is `"none" | "full" | "equal"`. `RetryPolicy` is `(error: unknown, context: RetryContext) => boolean`.
- `RetryContext` is `{ attempt: number; elapsedMs: number }`. The `onRetry` context adds `delayMs: number`. Elapsed time uses `Date.now()`.
- Delay before a retry is `min(maxDelayMs, minDelayMs * factor ** attempt)`. Full jitter multiplies that ceiling by a random value in `[0, 1]`; equal jitter selects from `[ceiling / 2, ceiling]`. Inject `random` and `sleep` for deterministic behavior.
- `abortableSleep(milliseconds, signal?) -> Promise<void>` validates a finite non-negative duration and clears its timer and abort listener on completion. If cancellation occurs, it rejects with `RetryAbortedError`.
- `RetryAbortedError(message?, options?)` extends `Error`; the message defaults to `"Retry operation was aborted"`, and its `cause` contains `signal.reason` when available. It represents abort during the delay or before the next operation. If the operation itself rejects after abort, that error is evaluated normally until the next boundary.

Invalid numeric options, an unknown jitter mode, a random sample outside `[0, 1]`, or a delay outside the finite non-negative range throws `RangeError`. The operation itself is not forcibly interrupted; pass `signal` into it when it supports cancellation. Retry counts are additional attempts, not total calls.

## Compatibility and references

Uses ES2022 features (`Error` causes and `AbortSignal`) and exposes ESM and CommonJS entry points with matching declarations. See [AbortController](https://developer.mozilla.org/docs/Web/API/AbortController) and [exponential backoff](https://en.wikipedia.org/wiki/Exponential_backoff).

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
