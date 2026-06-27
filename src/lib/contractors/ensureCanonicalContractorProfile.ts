import type { Firestore } from "firebase-admin/firestore";
import { recordDeploymentIntelligenceEvent } from "@/lib/compliance/complianceOperationalEvents";

export const TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID = "torque-empire-benchmark";

export async function ensureCanonicalContractorProfile(db: Firestore) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_BENCHMARK_CONTRACTOR !== "true") {
    throw new Error("benchmark_contractor_disabled_in_production");
  }

  const contractorRef = db.collection("contractors").doc(TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID);
  const snapshot = await contractorRef.get();
  const now = new Date();

  if (snapshot.exists) {
    await contractorRef.set(
      {
        canonicalProfile: true,
        benchmarkContractor: true,
        operationalReplayContractor: true,
        regressionValidationContractor: true,
        updatedAt: now.toISOString(),
      },
      { merge: true },
    );

    await recordDeploymentIntelligenceEvent({
      db,
      contractorId: TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID,
      eventType: "canonical_profile_validated",
      details: {
        canonicalProfile: true,
        benchmarkContractor: true,
      },
    });

    return {
      contractorId: TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID,
      created: false,
    };
  }

  await contractorRef.set({
    id: TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID,
    contractorId: TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID,
    name: "Torque Empire PTY Ltd",
    companyName: "Torque Empire PTY Ltd",
    status: "pending",
    canonicalProfile: true,
    benchmarkContractor: true,
    operationalReplayContractor: true,
    regressionValidationContractor: true,
    demoContractor: true,
    createdAt: now.getTime(),
    updatedAt: now.toISOString(),
    createdBy: "system",
    metadata: {
      createdVia: "ensureCanonicalContractorProfile",
      canonicalPurpose: [
        "benchmark contractor",
        "regression validation contractor",
        "demo contractor",
        "operational replay contractor",
      ],
    },
    auditTrail: [
      {
        id: `${TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID}:created:${now.getTime()}`,
        type: "contractor_created",
        message: "Canonical Torque Empire contractor profile created",
        performedByUid: "system",
        performedByEmail: null,
        performedByRole: "system",
        createdAt: now.toISOString(),
      },
    ],
  });

  await recordDeploymentIntelligenceEvent({
    db,
    contractorId: TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID,
    eventType: "canonical_profile_created",
    details: {
      canonicalProfile: true,
      contractorName: "Torque Empire PTY Ltd",
    },
  });

  return {
    contractorId: TORQUE_EMPIRE_CANONICAL_CONTRACTOR_ID,
    created: true,
  };
}
