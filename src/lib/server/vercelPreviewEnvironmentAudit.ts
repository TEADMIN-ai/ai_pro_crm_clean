import fs from "node:fs";

import {
  TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
  TEOS_STAGING_FIREBASE_PROJECT_ID,
} from "@/lib/server/environmentSafety";

export const TEOS_STAGING_FIREBASE_STORAGE_BUCKET = "torque-empire-teos-staging.firebasestorage.app";

export const REQUIRED_PREVIEW_FIREBASE_VARIABLES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_STORAGE_BUCKET",
  "TEOS_ENVIRONMENT",
] as const;

export type VercelEnvironmentScope = "preview" | "production";
export type VercelEnvironmentMap = Record<string, string | undefined>;

export type VercelEnvironmentAuditInput = {
  preview: VercelEnvironmentMap;
  production: VercelEnvironmentMap;
};

export type VercelEnvironmentAuditCheck = {
  id: string;
  scope: VercelEnvironmentScope | "cross-scope";
  passed: boolean;
  message: string;
};

export type VercelEnvironmentAuditReport = {
  ok: boolean;
  expected: {
    previewProjectId: typeof TEOS_STAGING_FIREBASE_PROJECT_ID;
    previewStorageBucket: typeof TEOS_STAGING_FIREBASE_STORAGE_BUCKET;
    productionProjectId: typeof TEOS_PRODUCTION_FIREBASE_PROJECT_ID;
  };
  requiredPreviewVariables: readonly string[];
  checks: VercelEnvironmentAuditCheck[];
  missingPreviewVariables: string[];
};

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/^"(.*)"$/, "$1");
  return trimmed ? trimmed : null;
}

function normalizeBucket(value: string | undefined): string | null {
  const bucket = clean(value);
  if (!bucket) return null;

  return bucket
    .replace(/^gs:\/\//, "")
    .replace(/^https?:\/\/storage.googleapis.com\//, "")
    .replace(/\/+$/, "");
}

function hasValue(env: VercelEnvironmentMap, name: string): boolean {
  return clean(env[name]) !== null;
}

export function parseEnvFile(filePath: string): VercelEnvironmentMap {
  const content = fs.readFileSync(filePath, "utf8");
  const env: VercelEnvironmentMap = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^['"](.*)['"]$/, "$1");
  }

  return env;
}

export function auditVercelPreviewEnvironment(
  input: VercelEnvironmentAuditInput,
): VercelEnvironmentAuditReport {
  const previewProjectId = clean(input.preview.FIREBASE_PROJECT_ID);
  const previewPublicProjectId = clean(input.preview.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const previewStorageBucket = normalizeBucket(input.preview.FIREBASE_STORAGE_BUCKET);
  const previewTeosEnvironment = clean(input.preview.TEOS_ENVIRONMENT);
  const previewPublicStorageBucket = normalizeBucket(input.preview.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const productionProjectId = clean(input.production.FIREBASE_PROJECT_ID);
  const productionPublicProjectId = clean(input.production.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const productionStorageBucket = normalizeBucket(input.production.FIREBASE_STORAGE_BUCKET);
  const productionTeosEnvironment = clean(input.production.TEOS_ENVIRONMENT);
  const productionPublicStorageBucket = normalizeBucket(input.production.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const missingPreviewVariables = REQUIRED_PREVIEW_FIREBASE_VARIABLES.filter(
    (name) => !hasValue(input.preview, name),
  );

  const checks: VercelEnvironmentAuditCheck[] = [
    {
      id: "preview-required-variables",
      scope: "preview",
      passed: missingPreviewVariables.length === 0,
      message: missingPreviewVariables.length === 0
        ? "All required Preview Firebase variables exist."
        : `Missing required Preview Firebase variables: ${missingPreviewVariables.join(", ")}`,
    },
    {
      id: "preview-teos-environment-is-staging",
      scope: "preview",
      passed: previewTeosEnvironment === "staging",
      message: "Preview TEOS_ENVIRONMENT must equal staging.",
    },
    {
      id: "preview-admin-project-is-staging",
      scope: "preview",
      passed: previewProjectId === TEOS_STAGING_FIREBASE_PROJECT_ID,
      message: "Preview FIREBASE_PROJECT_ID must equal the staging Firebase project ID.",
    },
    {
      id: "preview-public-project-is-staging",
      scope: "preview",
      passed: previewPublicProjectId === TEOS_STAGING_FIREBASE_PROJECT_ID,
      message: "Preview NEXT_PUBLIC_FIREBASE_PROJECT_ID must equal the staging Firebase project ID.",
    },
    {
      id: "preview-admin-bucket-is-staging",
      scope: "preview",
      passed: previewStorageBucket === TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
      message: "Preview FIREBASE_STORAGE_BUCKET must equal the staging Storage bucket.",
    },
    {
      id: "preview-public-bucket-is-staging",
      scope: "preview",
      passed: previewPublicStorageBucket === TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
      message: "Preview NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET must equal the staging Storage bucket.",
    },
    {
      id: "production-teos-environment-is-not-staging",
      scope: "production",
      passed: productionTeosEnvironment !== "staging",
      message: "Production TEOS_ENVIRONMENT must not equal staging.",
    },
    {
      id: "production-admin-project-is-production",
      scope: "production",
      passed: productionProjectId === TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      message: "Production FIREBASE_PROJECT_ID must remain the production Firebase project ID.",
    },
    {
      id: "production-public-project-is-production",
      scope: "production",
      passed: productionPublicProjectId === TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      message: "Production NEXT_PUBLIC_FIREBASE_PROJECT_ID must remain the production Firebase project ID.",
    },
    {
      id: "production-admin-project-is-not-staging",
      scope: "production",
      passed: productionProjectId !== TEOS_STAGING_FIREBASE_PROJECT_ID,
      message: "Production FIREBASE_PROJECT_ID must not use the staging Firebase project ID.",
    },
    {
      id: "production-bucket-is-not-staging",
      scope: "production",
      passed: productionStorageBucket !== TEOS_STAGING_FIREBASE_STORAGE_BUCKET
        && productionPublicStorageBucket !== TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
      message: "Production Storage buckets must not use the staging bucket.",
    },
    {
      id: "preview-production-projects-differ",
      scope: "cross-scope",
      passed: Boolean(previewProjectId && productionProjectId && previewProjectId !== productionProjectId),
      message: "Preview and Production Firebase project IDs must differ.",
    },
    {
      id: "preview-production-buckets-differ",
      scope: "cross-scope",
      passed: Boolean(previewStorageBucket && productionStorageBucket && previewStorageBucket !== productionStorageBucket),
      message: "Preview and Production Storage buckets must differ.",
    },
  ];

  return {
    ok: checks.every((check) => check.passed),
    expected: {
      previewProjectId: TEOS_STAGING_FIREBASE_PROJECT_ID,
      previewStorageBucket: TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
      productionProjectId: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
    },
    requiredPreviewVariables: REQUIRED_PREVIEW_FIREBASE_VARIABLES,
    checks,
    missingPreviewVariables,
  };
}

export function formatVercelEnvironmentAuditReport(report: VercelEnvironmentAuditReport): string {
  const lines = [
    "TEOS Vercel Preview environment audit",
    `Expected Preview project: ${report.expected.previewProjectId}`,
    `Expected Preview bucket: ${report.expected.previewStorageBucket}`,
    `Expected Production project: ${report.expected.productionProjectId}`,
    `Required Preview variables: ${report.requiredPreviewVariables.join(", ")}`,
    "",
    ...report.checks.map((check) => {
      const status = check.passed ? "PASS" : "FAIL";
      return `${status} [${check.scope}] ${check.id}: ${check.message}`;
    }),
  ];

  lines.push("");
  lines.push(report.ok ? "PASS: Preview Firebase staging configuration is isolated." : "FAIL: Preview Firebase staging configuration is not safe.");

  return lines.join("\n");
}
