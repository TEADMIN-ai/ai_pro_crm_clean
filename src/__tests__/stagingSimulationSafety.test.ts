import { TEOS_PRODUCTION_FIREBASE_PROJECT_ID, TEOS_STAGING_FIREBASE_PROJECT_ID } from "@/lib/server/environmentSafety";
import { assertStagingSimulationAllowed, isStagingSimulationAllowed } from "@/lib/server/stagingSimulationSafety";

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}
function expectBlocked(values: Record<string, string | undefined>) {
  const next = env(values);
  expect(isStagingSimulationAllowed(next)).toBe(false);
  expect(() => assertStagingSimulationAllowed(next)).toThrow("Staging simulation is not allowed");
}

describe("staging simulation safety", () => {
  test("Vercel Preview with staging project permits simulation", () => {
    const next = env({ VERCEL_ENV: "preview", FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID });
    expect(isStagingSimulationAllowed(next)).toBe(true);
    expect(assertStagingSimulationAllowed(next).firebaseProjectId).toBe(TEOS_STAGING_FIREBASE_PROJECT_ID);
  });
  test("local development with staging project and server-only opt-in permits simulation", () => {
    const next = env({ NODE_ENV: "development", FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID, TEOS_ALLOW_STAGING_SIMULATION: "true" });
    expect(isStagingSimulationAllowed(next)).toBe(true);
    expect(assertStagingSimulationAllowed(next).deploymentEnvironment).toBe("development");
  });
  test("local development with staging project without opt-in is blocked", () => {
    expectBlocked({ NODE_ENV: "development", FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID });
  });
  test("local development with production project and opt-in is blocked", () => {
    expectBlocked({ NODE_ENV: "development", FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID, TEOS_ALLOW_STAGING_SIMULATION: "true" });
  });
  test("preview with production project is blocked", () => {
    expectBlocked({ VERCEL_ENV: "preview", FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID });
  });
  test("mismatched public and admin project IDs are blocked", () => {
    expectBlocked({ VERCEL_ENV: "preview", FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_PRODUCTION_FIREBASE_PROJECT_ID });
  });
  test("missing project identity is blocked", () => {
    expectBlocked({ VERCEL_ENV: "preview" });
  });
  test("production classification with opt-in is blocked", () => {
    expectBlocked({ VERCEL_ENV: "production", FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEOS_STAGING_FIREBASE_PROJECT_ID, TEOS_ALLOW_STAGING_SIMULATION: "true" });
  });
});
