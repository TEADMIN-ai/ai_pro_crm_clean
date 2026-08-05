import {
  assertFirebaseEnvironmentSafe,
  EnvironmentSafetyError,
  getServerEnvironmentClassification,
} from "@/lib/server/environmentSafety";

function main() {
  const classification = getServerEnvironmentClassification();

  console.log("TEOS staging environment verification");
  console.log({
    deploymentEnvironment: classification.deploymentEnvironment,
    firebaseProjectId: classification.firebaseProjectId,
    publicFirebaseProjectId: classification.publicFirebaseProjectId,
    publicAndAdminProjectIdsAgree: classification.publicAndAdminProjectIdsAgree,
    storageBucket: classification.storageBucket,
    firebaseProjectClassification: classification.firebaseProjectClassification,
    isVerifiedStaging: classification.isVerifiedStaging,
    isVerifiedProduction: classification.isVerifiedProduction,
  });

  try {
    assertFirebaseEnvironmentSafe({ operation: "protected-write" });
    console.log("PASS: Firebase environment is safe for this deployment context.");
  } catch (error) {
    if (error instanceof EnvironmentSafetyError) {
      console.error("FAIL:", error.message);
      process.exitCode = 1;
      return;
    }

    console.error("FAIL: Unknown environment verification error.");
    process.exitCode = 1;
  }
}

main();
