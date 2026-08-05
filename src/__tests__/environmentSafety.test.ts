import {
  assertFirebaseEnvironmentSafe,
  getServerEnvironmentClassification,
  getStagingBannerState,
  TEOS_DEVELOPMENT_PRODUCTION_FIREBASE_OVERRIDE,
  TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
  TEOS_STAGING_FIREBASE_PROJECT_ID,
  TEOS_TEST_CONTEXT_FLAG,
} from "@/lib/server/environmentSafety";

type TestEnv = Record<string, string | undefined>;

function baseEnv(overrides: TestEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: `${TEOS_STAGING_FIREBASE_PROJECT_ID}.firebasestorage.app`,
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("environment safety", () => {
  it("fails closed when Preview uses production Firebase", () => {
    const env = baseEnv({
      VERCEL_ENV: "preview",
      FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
    });

    expect(() => assertFirebaseEnvironmentSafe({ env })).toThrow(/Preview deployments may not use/);
  });

  it("allows Preview with staging Firebase", () => {
    const env = baseEnv({ VERCEL_ENV: "preview" });

    const classification = assertFirebaseEnvironmentSafe({ env });

    expect(classification.isVerifiedStaging).toBe(true);
  });

  it("allows Production with production Firebase", () => {
    const env = baseEnv({
      VERCEL_ENV: "production",
      FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
    });

    const classification = assertFirebaseEnvironmentSafe({ env });

    expect(classification.isVerifiedProduction).toBe(true);
  });

  it("fails closed when Production uses staging Firebase", () => {
    const env = baseEnv({ VERCEL_ENV: "production" });

    expect(() => assertFirebaseEnvironmentSafe({ env })).toThrow(/Production deployments may not use/);
  });

  it("fails closed when protected writes have no project ID", () => {
    const env = baseEnv({ VERCEL_ENV: "preview", FIREBASE_PROJECT_ID: "", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "" });

    expect(() => assertFirebaseEnvironmentSafe({ env })).toThrow(/Missing server Firebase project identity/);
  });

  it("fails closed when protected writes have no deployment identity", () => {
    const env = baseEnv({ VERCEL_ENV: undefined, NODE_ENV: undefined });

    expect(() => assertFirebaseEnvironmentSafe({ env })).toThrow(/Missing server deployment environment identity/);
  });

  it("fails closed when public and Admin project IDs differ", () => {
    const env = baseEnv({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "different-staging-project",
    });

    expect(() => assertFirebaseEnvironmentSafe({ env })).toThrow(/do not match/);
  });

  it("supports explicit test context with mocked configuration", () => {
    const env = baseEnv({
      NODE_ENV: "test",
      [TEOS_TEST_CONTEXT_FLAG]: "true",
      FIREBASE_PROJECT_ID: "mocked-test-project",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "mocked-test-project",
    });

    const classification = assertFirebaseEnvironmentSafe({ env });

    expect(classification.deploymentEnvironment).toBe("test");
    expect(classification.firebaseProjectClassification).toBe("other");
  });

  it("fails closed when development uses production Firebase without explicit override", () => {
    const env = baseEnv({
      VERCEL_ENV: "development",
      FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
    });

    expect(() => assertFirebaseEnvironmentSafe({ env })).toThrow(/Development may not use/);
  });

  it("allows development production Firebase only with the explicit override", () => {
    const env = baseEnv({
      VERCEL_ENV: "development",
      FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      [TEOS_DEVELOPMENT_PRODUCTION_FIREBASE_OVERRIDE]: "allow-development-production-firebase",
    });

    const classification = assertFirebaseEnvironmentSafe({ env });

    expect(classification.developmentProductionOverrideEnabled).toBe(true);
  });

  it("does not display the staging banner in production", () => {
    const env = baseEnv({
      VERCEL_ENV: "production",
      FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
    });

    expect(getStagingBannerState(env).show).toBe(false);
  });

  it("displays the staging banner flag for verified staging", () => {
    const env = baseEnv({ VERCEL_ENV: "preview" });

    const banner = getStagingBannerState(env);

    expect(banner.show).toBe(true);
    expect(banner.label).toBe("STAGING - TEST DATA ONLY");
  });

  it("returns non-secret classification fields for diagnostics", () => {
    const classification = getServerEnvironmentClassification(baseEnv({ VERCEL_ENV: "preview" }));

    expect(classification).toMatchObject({
      firebaseProjectId: TEOS_STAGING_FIREBASE_PROJECT_ID,
      publicFirebaseProjectId: TEOS_STAGING_FIREBASE_PROJECT_ID,
      storageBucket: `${TEOS_STAGING_FIREBASE_PROJECT_ID}.firebasestorage.app`,
    });
    expect(JSON.stringify(classification)).not.toContain("PRIVATE KEY");
  });
});
