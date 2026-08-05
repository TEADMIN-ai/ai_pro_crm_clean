export const TEOS_PRODUCTION_FIREBASE_PROJECT_ID = "torque-empire-ai-pro-crm";
export const TEOS_STAGING_FIREBASE_PROJECT_ID = "torque-empire-ai-pro-crm-staging";
export const TEOS_DEVELOPMENT_PRODUCTION_FIREBASE_OVERRIDE = "TEOS_ALLOW_DEVELOPMENT_PRODUCTION_FIREBASE";
export const TEOS_TEST_CONTEXT_FLAG = "TEOS_ENVIRONMENT_SAFETY_TEST_CONTEXT";

export type ServerDeploymentEnvironment = "production" | "preview" | "development" | "test" | "unknown";
export type FirebaseProjectClassification = "production" | "staging" | "other" | "missing";

export type EnvironmentClassification = {
  deploymentEnvironment: ServerDeploymentEnvironment;
  firebaseProjectId: string | null;
  publicFirebaseProjectId: string | null;
  storageBucket: string | null;
  firebaseProjectClassification: FirebaseProjectClassification;
  publicAndAdminProjectIdsAgree: boolean | null;
  isProductionFirebase: boolean;
  isStagingFirebase: boolean;
  isVerifiedStaging: boolean;
  isVerifiedProduction: boolean;
  developmentProductionOverrideEnabled: boolean;
};

export type EnvironmentSafetyOperation = "admin-init" | "protected-write" | "diagnostic";

export type EnvironmentSafetyOptions = {
  env?: NodeJS.ProcessEnv;
  operation?: EnvironmentSafetyOperation;
  requireProjectId?: boolean;
  requireDeploymentIdentity?: boolean;
  allowDevelopmentProductionOverride?: boolean;
};

export class EnvironmentSafetyError extends Error {
  constructor(message: string, public readonly classification: EnvironmentClassification) {
    super(message);
    this.name = "EnvironmentSafetyError";
  }
}

export class ProtectedFirebaseEnvironmentError extends EnvironmentSafetyError {
  constructor(message: string, classification: EnvironmentClassification) {
    super(message, classification);
    this.name = "ProtectedFirebaseEnvironmentError";
  }
}

export class EnvironmentConfigurationError extends EnvironmentSafetyError {
  constructor(message: string, classification: EnvironmentClassification) {
    super(message, classification);
    this.name = "EnvironmentConfigurationError";
  }
}

export class PublicFirebaseConfigurationMismatchError extends EnvironmentSafetyError {
  constructor(message: string, classification: EnvironmentClassification) {
    super(message, classification);
    this.name = "PublicFirebaseConfigurationMismatchError";
  }
}

export class FirebaseEnvironmentMismatchError extends EnvironmentSafetyError {
  constructor(message: string, classification: EnvironmentClassification) {
    super(message, classification);
    this.name = "FirebaseEnvironmentMismatchError";
  }
}

function clean(value: string | undefined) {
  const trimmed = value?.trim().replace(/^"(.*)"$/, "$1");
  return trimmed ? trimmed : null;
}

function classifyDeploymentEnvironment(env: NodeJS.ProcessEnv): ServerDeploymentEnvironment {
  const vercelEnv = clean(env.VERCEL_ENV)?.toLowerCase();
  const nodeEnv = clean(env.NODE_ENV)?.toLowerCase();

  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "development";
  if (nodeEnv === "test" || clean(env[TEOS_TEST_CONTEXT_FLAG]) === "true") return "test";
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "development") return "development";

  return "unknown";
}

function classifyFirebaseProject(projectId: string | null): FirebaseProjectClassification {
  if (!projectId) return "missing";
  if (projectId === TEOS_PRODUCTION_FIREBASE_PROJECT_ID) return "production";
  if (projectId === TEOS_STAGING_FIREBASE_PROJECT_ID) return "staging";
  return "other";
}

export function getServerEnvironmentClassification(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentClassification {
  const deploymentEnvironment = classifyDeploymentEnvironment(env);
  const firebaseProjectId = clean(env.FIREBASE_PROJECT_ID);
  const publicFirebaseProjectId = clean(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const storageBucket = clean(env.FIREBASE_STORAGE_BUCKET) ?? clean(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const firebaseProjectClassification = classifyFirebaseProject(firebaseProjectId);
  const publicAndAdminProjectIdsAgree = firebaseProjectId && publicFirebaseProjectId
    ? firebaseProjectId === publicFirebaseProjectId
    : null;
  const developmentProductionOverrideEnabled = clean(env[TEOS_DEVELOPMENT_PRODUCTION_FIREBASE_OVERRIDE])
    === "allow-development-production-firebase";

  return {
    deploymentEnvironment,
    firebaseProjectId,
    publicFirebaseProjectId,
    storageBucket,
    firebaseProjectClassification,
    publicAndAdminProjectIdsAgree,
    isProductionFirebase: firebaseProjectClassification === "production",
    isStagingFirebase: firebaseProjectClassification === "staging",
    isVerifiedStaging: deploymentEnvironment === "preview" && firebaseProjectClassification === "staging",
    isVerifiedProduction: deploymentEnvironment === "production" && firebaseProjectClassification === "production",
    developmentProductionOverrideEnabled,
  };
}

export function assertFirebaseEnvironmentSafe(
  options: EnvironmentSafetyOptions = {},
): EnvironmentClassification {
  const env = options.env ?? process.env;
  const classification = getServerEnvironmentClassification(env);
  const operation = options.operation ?? "protected-write";
  const requireProjectId = options.requireProjectId ?? operation !== "diagnostic";
  const requireDeploymentIdentity = options.requireDeploymentIdentity ?? operation !== "diagnostic";
  const allowDevelopmentProductionOverride = options.allowDevelopmentProductionOverride ?? true;

  if (requireDeploymentIdentity && classification.deploymentEnvironment === "unknown") {
    throw new EnvironmentConfigurationError("Missing server deployment environment identity.", classification);
  }

  if (requireProjectId && !classification.firebaseProjectId) {
    throw new EnvironmentConfigurationError("Missing server Firebase project identity.", classification);
  }

  if (classification.publicAndAdminProjectIdsAgree === false) {
    throw new PublicFirebaseConfigurationMismatchError(
      "Server and public Firebase project IDs do not match.",
      classification,
    );
  }

  if (classification.deploymentEnvironment === "preview" && classification.isProductionFirebase) {
    throw new ProtectedFirebaseEnvironmentError(
      "Preview deployments may not use the production Firebase project.",
      classification,
    );
  }

  if (classification.deploymentEnvironment === "production" && classification.isStagingFirebase) {
    throw new FirebaseEnvironmentMismatchError(
      "Production deployments may not use the staging Firebase project.",
      classification,
    );
  }

  if (
    classification.deploymentEnvironment === "development"
    && classification.isProductionFirebase
    && (!allowDevelopmentProductionOverride || !classification.developmentProductionOverrideEnabled)
  ) {
    throw new ProtectedFirebaseEnvironmentError(
      "Development may not use the production Firebase project without an explicit override.",
      classification,
    );
  }

  return classification;
}

export function getStagingBannerState(env: NodeJS.ProcessEnv = process.env) {
  const classification = getServerEnvironmentClassification(env);

  return {
    show: classification.isVerifiedStaging,
    label: classification.isVerifiedStaging ? "STAGING - TEST DATA ONLY" : null,
    classification,
  };
}
