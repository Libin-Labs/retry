import { retry, RetryAbortedError, abortableSleep, type RetryOptions } from '@lp-labs/retry';

const options: RetryOptions = {
  retries: 2,
  jitter: 'full',
  shouldRetry: (_error, context) => context.attempt < 2,
};
// @ts-expect-error Only the documented jitter modes are accepted.
const invalidOptions: RetryOptions = { jitter: 'random' };
void retry(async ({ attempt }) => attempt, options);
void abortableSleep(1);
new RetryAbortedError();
void invalidOptions;
