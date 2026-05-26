const toPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
};

export const manusConfig = {
  workflows: {
    timeoutMs: toPositiveInteger(process.env.MANUS_WORKFLOW_TIMEOUT_MS, 90_000),
    stepTimeoutMs: toPositiveInteger(process.env.MANUS_STEP_TIMEOUT_MS, 30_000),
    maxRetries: toPositiveInteger(process.env.MANUS_MAX_RETRIES, 2),
    concurrency: toPositiveInteger(process.env.MANUS_MAX_CONCURRENCY, 2),
  },
  models: {
    orchestration: process.env.OPENAI_MANUS_MODEL?.trim() || process.env.OPENAI_TENDER_MODEL?.trim() || "gpt-4.1-mini",
    summarization:
      process.env.OPENAI_MANUS_SUMMARY_MODEL?.trim() || process.env.OPENAI_DOCUMENT_MODEL?.trim() || "gpt-4.1-mini",
  },
  logging: {
    enabled: toBoolean(process.env.MANUS_LOGGING_ENABLED, true),
    verbose: toBoolean(process.env.MANUS_LOGGING_VERBOSE, false),
  },
  memory: {
    retentionDays: toPositiveInteger(process.env.MANUS_MEMORY_RETENTION_DAYS, 365),
  },
  openai: {
    maxOutputTokens: toPositiveInteger(process.env.MANUS_MAX_OUTPUT_TOKENS, 1200),
  },
} as const;

export type ManusConfig = typeof manusConfig;
