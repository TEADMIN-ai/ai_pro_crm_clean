
import {
  STAGING_CANONICAL_CONTRACTOR_ID,
  STAGING_FIREBASE_PROJECT_ID,
  STAGING_SEED_CREATED_BY,
  STAGING_SEED_VERSION,
  STAGING_SYNTHETIC_DEAL_ID,
  STAGING_UNRESOLVED_CONTRACTOR_ID,
  assertStagingSeedEnvironment,
  buildStagingResetRecordPaths,
  buildStagingUatSeedPlan,
  isStagingSyntheticRecord,
  validateStagingPasswords,
  type StagingSeedUser,
} from "@/lib/staging/stagingUatSeedPlan";

const users: StagingSeedUser[] = [
  { key: "admin", email: "teos.staging.admin@invalid.example", displayName: "TEOS Staging Admin", passwordEnv: "TEOS_STAGING_ADMIN_PASSWORD", uid: "uid-admin" },
  { key: "staff", email: "teos.staging.staff@invalid.example", displayName: "TEOS Staging Staff", passwordEnv: "TEOS_STAGING_STAFF_PASSWORD", uid: "uid-staff" },
];

describe("staging UAT seed plan", () => {
  it("fails closed outside the staging Firebase project and environment", () => {
    expect(() => assertStagingSeedEnvironment({ FIREBASE_PROJECT_ID: "torque-empire-ai-pro-crm", TEOS_ENVIRONMENT: "staging" } as unknown as NodeJS.ProcessEnv)).toThrow(/FIREBASE_PROJECT_ID/);
    expect(() => assertStagingSeedEnvironment({ FIREBASE_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID, TEOS_ENVIRONMENT: "production" } as unknown as NodeJS.ProcessEnv)).toThrow(/TEOS_ENVIRONMENT/);
  });

  it("requires temporary passwords without exposing values", () => {
    expect(() => validateStagingPasswords({ TEOS_STAGING_ADMIN_PASSWORD: "short", TEOS_STAGING_STAFF_PASSWORD: "long-enough-password" } as unknown as NodeJS.ProcessEnv)).toThrow(/TEOS_STAGING_ADMIN_PASSWORD/);
    expect(() => validateStagingPasswords({ TEOS_STAGING_ADMIN_PASSWORD: "long-enough-password", TEOS_STAGING_STAFF_PASSWORD: "another-long-password" } as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });
  it("builds deterministic synthetic records with required staging markers", () => {
    const plan = buildStagingUatSeedPlan(users, new Date("2026-08-05T10:00:00.000Z"));
    const paths = plan.records.map((record) => record.path);

    expect(paths).toContain("users/uid-admin");
    expect(paths).toContain("users/uid-staff");
    expect(paths).toContain("contractors/" + STAGING_CANONICAL_CONTRACTOR_ID);
    expect(paths).toContain("contractors/" + STAGING_UNRESOLVED_CONTRACTOR_ID);
    expect(paths).toContain("deals/" + STAGING_SYNTHETIC_DEAL_ID);
    expect(paths).toContain("contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/documents/taxClearance");
    expect(paths).toContain("contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/documents/csd");

    for (const record of plan.records) {
      expect(record.data.environment).toBe("staging");
      expect(record.data.syntheticData).toBe(true);
      expect(record.data.seedVersion).toBe(STAGING_SEED_VERSION);
      expect(record.data.createdBy).toBe(STAGING_SEED_CREATED_BY);
      expect(isStagingSyntheticRecord(record.data)).toBe(true);
    }
  });

  it("marks the unresolved contractor as blocked seed data and reset paths are exact documents", () => {
    const plan = buildStagingUatSeedPlan(users, new Date("2026-08-05T10:00:00.000Z"));
    const unresolved = plan.records.find((record) => record.path === "contractors/" + STAGING_UNRESOLVED_CONTRACTOR_ID)?.data;
    const resetPaths = buildStagingResetRecordPaths(users);

    expect(unresolved?.status).toBe("onboarding");
    expect(unresolved?.complianceApproved).toBe(false);
    expect(resetPaths.every((path) => path.split("/").length % 2 === 0)).toBe(true);
    expect(resetPaths.some((path) => path === "contractors" || path === "deals" || path === "users")).toBe(false);
  });
});

test("staging UAT seed authority targets the live TEOS staging Firebase project", () => {
  expect(STAGING_FIREBASE_PROJECT_ID).toBe("torque-empire-teos-staging");
  expect(STAGING_FIREBASE_PROJECT_ID).not.toBe("torque-empire-ai-pro-crm-staging");
});
