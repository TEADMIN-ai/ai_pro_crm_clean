import {
  EnvironmentConfigurationError,
  TEOS_PRODUCTION_FIREBASE_PROJECT_ID,
  TEOS_STAGING_FIREBASE_PROJECT_ID,
  getServerEnvironmentClassification,
  type EnvironmentClassification,
} from "@/lib/server/environmentSafety";

export const STAGING_SIMULATION_SOURCE = "TEOS_STAGING_SIMULATION";
export const STAGING_SIMULATION_AUTHORITY = "STAGING_TEST_ONLY";
export const STAGING_SIMULATION_MESSAGE = "Simulated staging verification - no external authority contacted.";

export class StagingSimulationSafetyError extends EnvironmentConfigurationError {
  constructor(message: string, classification: EnvironmentClassification) {
    super(message, classification);
    this.name = "StagingSimulationSafetyError";
  }
}

export function isStagingSimulationAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const classification = getServerEnvironmentClassification(env);
  const stagingFirebaseIdentityConfirmed =
    classification.firebaseProjectId === TEOS_STAGING_FIREBASE_PROJECT_ID &&
    classification.publicFirebaseProjectId === TEOS_STAGING_FIREBASE_PROJECT_ID &&
    classification.firebaseProjectClassification === "staging" &&
    classification.publicAndAdminProjectIdsAgree === true;
  const productionClassification =
    classification.deploymentEnvironment === "production" ||
    classification.isProductionFirebase === true ||
    classification.firebaseProjectId === TEOS_PRODUCTION_FIREBASE_PROJECT_ID ||
    classification.publicFirebaseProjectId === TEOS_PRODUCTION_FIREBASE_PROJECT_ID;
  const verifiedVercelPreview = classification.isVerifiedStaging === true;
  const verifiedLocalDevelopment =
    classification.deploymentEnvironment === "development" &&
    env.TEOS_ALLOW_STAGING_SIMULATION === "true";

  return stagingFirebaseIdentityConfirmed && (verifiedVercelPreview || verifiedLocalDevelopment) && !productionClassification;
}

export function assertStagingSimulationAllowed(env: NodeJS.ProcessEnv = process.env): EnvironmentClassification {
  const classification = getServerEnvironmentClassification(env);
  if (!isStagingSimulationAllowed(env)) {
    throw new StagingSimulationSafetyError("Staging simulation is not allowed for this server environment.", classification);
  }
  return classification;
}

export function isStagingSimulationRecord(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.simulation === true || record.testOnly === true || record.verificationSource === STAGING_SIMULATION_SOURCE || record.source === STAGING_SIMULATION_SOURCE;
}
