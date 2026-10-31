import retryPackage = require('@lp-labs/retry');

const options: retryPackage.RetryOptions = { retries: 1, factor: 2 };
void retryPackage.retry(() => 'ok', options);
void retryPackage.abortableSleep(0);
