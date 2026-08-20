import {
  auditVercelPreviewEnvironment,
  formatVercelEnvironmentAuditReport,
  REQUIRED_PREVIEW_FIREBASE_VARIABLES,
  TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
} from "@/lib/server/vercelPreviewEnvironmentAudit";
import {
  TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
  TEOS_STAGING_FIREBASE_PROJECT_ID,
} from "@/lib/server/environmentSafety";

const SECRET_PRIVATE_KEY = "redacted-test-private-key-sentinel";
const SECRET_API_KEY = "redacted-test-api-key-sentinel";

function previewEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: SECRET_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "torque-empire-teos-staging.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:staging",
    FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: "staging-admin@example.iam.gserviceaccount.com",
    FIREBASE_PRIVATE_KEY: SECRET_PRIVATE_KEY,
    FIREBASE_STORAGE_BUCKET: TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
    TEOS_ENVIRONMENT: "staging",
    ...overrides,
  };
}

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "torque-empire-ai-pro-crm.firebasestorage.app",
    FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: "torque-empire-ai-pro-crm.firebasestorage.app",
    ...overrides,
  };
}

describe("Vercel Preview environment audit", () => {
  it("passes for isolated staging Preview and distinct Production Firebase values", () => {
    const report = auditVercelPreviewEnvironment({
      preview: previewEnv(),
      production: productionEnv(),
    });

    expect(report.ok).toBe(true);
  });

  it("rejects production project values in Preview", () => {
    const report = auditVercelPreviewEnvironment({
      preview: previewEnv({
        FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      }),
      production: productionEnv(),
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "preview-admin-project-is-staging")?.passed).toBe(false);
    expect(report.checks.find((check) => check.id === "preview-public-project-is-staging")?.passed).toBe(false);
  });

  it("rejects staging project and bucket values in Production", () => {
    const report = auditVercelPreviewEnvironment({
      preview: previewEnv(),
      production: productionEnv({
        FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
    TEOS_ENVIRONMENT: "staging",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: TEOS_STAGING_FIREBASE_STORAGE_BUCKET,
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "production-admin-project-is-production")?.passed).toBe(false);
    expect(report.checks.find((check) => check.id === "production-admin-project-is-not-staging")?.passed).toBe(false);
    expect(report.checks.find((check) => check.id === "production-bucket-is-not-staging")?.passed).toBe(false);
  });

  it("fails when required Preview variables are missing", () => {
    const report = auditVercelPreviewEnvironment({
      preview: previewEnv({
        FIREBASE_PRIVATE_KEY: undefined,
        NEXT_PUBLIC_FIREBASE_API_KEY: "",
      }),
      production: productionEnv(),
    });

    expect(report.ok).toBe(false);
    expect(report.missingPreviewVariables).toEqual(
      expect.arrayContaining(["FIREBASE_PRIVATE_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY"]),
    );
    expect(REQUIRED_PREVIEW_FIREBASE_VARIABLES).toContain("FIREBASE_PRIVATE_KEY");
  });

  it("does not include secret values in formatted output", () => {
    const report = auditVercelPreviewEnvironment({
      preview: previewEnv(),
      production: productionEnv(),
    });
    const output = formatVercelEnvironmentAuditReport(report);

    expect(output).not.toContain(SECRET_PRIVATE_KEY);
    expect(output).not.toContain(SECRET_API_KEY);
    expect(output).not.toContain("staging-admin@example.iam.gserviceaccount.com");
  });
});



