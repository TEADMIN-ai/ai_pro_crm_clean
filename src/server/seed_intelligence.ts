import { getAdmin } from "./firebase-admin";

/**
 * Seeds or updates system intelligence metadata.
 * Safe for server-only execution.
 */
export async function seedIntelligence(): Promise<void> {
  const { db } = getAdmin();

  const docRef = db.collection("intelligence").doc("system");

  await docRef.set(
    {
      lastSeededAt: new Date().toISOString(),
      status: "active",
      updatedBy: "seed_intelligence",
    },
    { merge: true }
  );
}