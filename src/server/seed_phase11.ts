import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase/config";

/**
 * PHASE 11 SEED SCRIPT
 * -------------------
 * Safe for production builds.
 * Does NOT auto-run during build.
 */

export async function seedPhase11Data() {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  // --- Intelligence Records ---
  await addDoc(collection(db, "intelligence"), {
    type: "phase11",
    description: "Phase 11 intelligence seed",
    createdAt: serverTimestamp(),
  });

  // --- Tender Scores ---
  await addDoc(collection(db, "tender_scores"), {
    tenderId: "demo-tender",
    score: 82,
    riskLevel: "medium",
    createdAt: serverTimestamp(),
  });

  // --- Fix Suggestions ---
  await addDoc(collection(db, "tender_fixes"), {
    tenderId: "demo-tender",
    suggestion: "Improve pricing clarity",
    createdAt: serverTimestamp(),
  });

  return { success: true };
}
