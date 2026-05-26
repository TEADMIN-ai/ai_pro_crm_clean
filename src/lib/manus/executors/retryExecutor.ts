import { manusConfig } from "@/lib/manus/config/manus.config";
import { TimeoutGuardError } from "@/lib/manus/utils/timeoutGuard";

export type RetryFailureClass = "timeout" | "transient" | "validation" | "fatal";

export interface RetryResult<T> {
  value: T;
  retriesUsed: number;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function classifyRetryFailure(error: unknown): RetryFailureClass {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (error instanceof TimeoutGuardError || message.includes("timed out")) {
    return "timeout";
  }

  if (message.includes("invalid") || message.includes("required") || message.includes("unauthorized")) {
    return "validation";
  }

  if (message.includes("unavailable") || message.includes("deadline") || message.includes("connection")) {
    return "transient";
  }

  return "fatal";
}

export class RetryExecutor {
  async execute<T>(options: {
    run: () => Promise<T>;
    maxRetries?: number;
    stepId?: string;
    onRetry?: (attempt: number, failureClass: RetryFailureClass) => Promise<void> | void;
  }): Promise<RetryResult<T>> {
    const maxRetries = options.maxRetries ?? manusConfig.workflows.maxRetries;
    let attempt = 0;

    while (true) {
      try {
        const value = await options.run();
        return { value, retriesUsed: attempt };
      } catch (error) {
        const failureClass = classifyRetryFailure(error);
        if (attempt >= maxRetries || failureClass === "validation" || failureClass === "fatal") {
          throw error;
        }

        attempt += 1;
        await options.onRetry?.(attempt, failureClass);
        const backoffMs = Math.min(250 * 2 ** (attempt - 1), 2_000);
        await delay(backoffMs);
      }
    }
  }
}
