export class TimeoutGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutGuardError";
  }
}

export async function runWithTimeoutGuard<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutPromise = new Promise<T>((_, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutGuardError(`Execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    controller.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
      },
      { once: true }
    );
  });

  return await Promise.race([task(controller.signal), timeoutPromise]);
}
