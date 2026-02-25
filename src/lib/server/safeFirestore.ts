function isTransientFirestoreError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error.message.toLowerCase();

  return (
    code === "aborted" ||
    code === "unavailable" ||
    code === "deadline-exceeded" ||
    message.includes("deadline exceeded") ||
    message.includes("service unavailable") ||
    message.includes("socket hang up") ||
    message.includes("connection reset")
  );
}

export async function safeFirestoreQuery<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    if (!isTransientFirestoreError(firstError)) {
      throw firstError;
    }

    return await fn();
  }
}
