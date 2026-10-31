import test from 'node:test';
import assert from 'node:assert/strict';
import { abortableSleep, retry, RetryAbortedError } from '../src/index.js';

test('returns immediately and exposes zero-based attempt context', async () => {
  const result = await retry((context) => {
    assert.deepEqual(context, { attempt: 0, elapsedMs: context.elapsedMs });
    return 42;
  });
  assert.equal(result, 42);
});

test('retries with capped backoff and reports retry events', async () => {
  let calls = 0;
  const delays: number[] = [];
  const events: number[] = [];
  const value = await retry(
    () => {
      calls += 1;
      if (calls < 4) throw new Error('temporary');
      return 'ok';
    },
    {
      retries: 5,
      minDelayMs: 10,
      maxDelayMs: 15,
      sleep: async (ms) => {
        delays.push(ms);
      },
      onRetry: (_error, context) => events.push(context.attempt),
    },
  );
  assert.equal(value, 'ok');
  assert.deepEqual(delays, [10, 15, 15]);
  assert.deepEqual(events, [0, 1, 2]);
});

test('supports retry policy, retry count zero and preserved final error', async () => {
  const failure = new Error('no');
  let calls = 0;
  await assert.rejects(
    retry(
      () => {
        calls++;
        throw failure;
      },
      { retries: 0 },
    ),
    (error) => error === failure,
  );
  await assert.rejects(
    retry(
      () => {
        calls++;
        throw failure;
      },
      { shouldRetry: () => false, sleep: async () => {} },
    ),
    (error) => error === failure,
  );
  assert.equal(calls, 2);
});

test('implements deterministic full and equal jitter and validates randomness', async () => {
  const delays: number[] = [];
  const failOnce = (() => {
    let calls = 0;
    return () => {
      if (!calls++) throw 'x';
      return true;
    };
  })();
  await retry(failOnce, {
    minDelayMs: 20,
    jitter: 'full',
    random: () => 0.25,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
  const failOnceAgain = (() => {
    let calls = 0;
    return () => {
      if (!calls++) throw 'x';
      return true;
    };
  })();
  await retry(failOnceAgain, {
    minDelayMs: 20,
    jitter: 'equal',
    random: () => 0.25,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
  assert.deepEqual(delays, [5, 12.5]);
  const fail = () => {
    throw 'x';
  };
  await assert.rejects(retry(fail, { random: () => 2, sleep: async () => {} }), RangeError);
});

test('validates options and aborts active or pre-aborted sleeps', async () => {
  await assert.rejects(
    retry(() => 1, { retries: -1 }),
    RangeError,
  );
  await assert.rejects(
    retry(() => 1, { factor: 0 }),
    RangeError,
  );
  const controller = new AbortController();
  controller.abort('stop');
  await assert.rejects(
    retry(
      () => {
        throw 'x';
      },
      { signal: controller.signal },
    ),
    RetryAbortedError,
  );
  await assert.rejects(abortableSleep(0, controller.signal), RetryAbortedError);
  const active = new AbortController();
  const sleeping = abortableSleep(10_000, active.signal);
  active.abort();
  await assert.rejects(sleeping, RetryAbortedError);
  assert.throws(() => abortableSleep(-1), RangeError);
});
