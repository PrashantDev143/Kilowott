export interface RetryDecision {
  isRetryable: boolean;
  delayMs: number;
  reason: string;
}

export function evaluateRetry(attempt: number, maxAttempts: number, error: any): RetryDecision {
  if (attempt >= maxAttempts) {
    return {
      isRetryable: false,
      delayMs: 0,
      reason: `Exceeded maximum retry attempts (${maxAttempts}).`
    };
  }

  const status = error?.status;
  const message = error?.message || '';

  // 4xx errors (except 429) are client/validation errors and are permanent (non-retryable)
  if (status && status >= 400 && status < 500 && status !== 429) {
    return {
      isRetryable: false,
      delayMs: 0,
      reason: `Permanent validation error (HTTP ${status}): ${message}`
    };
  }

  // 429 Rate limited, 5xx server errors, network timeouts, connection refused are retryable
  const baseDelayMs = 1500;
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 300);
  const delayMs = Math.min(30000, exponentialDelay + jitter);

  return {
    isRetryable: true,
    delayMs,
    reason: `Retryable failure (Attempt ${attempt}/${maxAttempts}): ${message}`
  };
}
