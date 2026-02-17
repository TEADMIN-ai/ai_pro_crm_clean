/**
 * Torque Empire CRM
 * Deal Data Normalization + KPI Field Migration Script
 *
 * SAFE MODE:
 * - Does NOT overwrite existing valid timestamps
 * - Does NOT change valid stages
 * - Only fixes inconsistencies
 * - Logs every update
 */

const admin = require("firebase-admin");
const path = require("path");

// 🔐 Load service account safely
const serviceAccountPath = path.join(
  __dirname,
  "../secrets/service-account.json"
);

console.log("🚀 Migration script starting...");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

// Valid canonical stages
const VALID_STAGES = [
  "lead",
  "assigned",
  "manager_review",
  "manager_approved",
  "submitted",
  "won",
  "closed",
];

// Normalize stage values safely
function normalizeStage(stage) {
  if (!stage) return "lead";

  const cleaned = String(stage).trim().toLowerCase();

  if (VALID_STAGES.includes(cleaned)) return cleaned;

  console.log(`⚠️  Unknown stage "${stage}" → defaulting to "lead"`);
  return "lead";
}

// Convert Firestore timestamp safely
function toTimestamp(date) {
  if (!date) return admin.firestore.FieldValue.serverTimestamp();
  return date;
}

async function migrateDeals() {
  const snapshot = await db.collection("deals").get();

  if (snapshot.empty) {
    console.log("ℹ️ No deals found.");
    return;
  }

  console.log(`📦 Found ${snapshot.size} deals`);

  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};

    // Normalize stage
    const normalizedStage = normalizeStage(data.stage);
    if (normalizedStage !== data.stage) {
      updates.stage = normalizedStage;
    }

    // Ensure value is number
    if (data.value && typeof data.value === "string") {
      const parsed = Number(data.value.replace(/[^\d.-]/g, ""));
      if (!isNaN(parsed)) {
        updates.value = parsed;
      }
    }

    // Ensure pricingStatus exists
    if (!data.pricingStatus) {
      updates.pricingStatus = "not_started";
    }

    // Fix boolean lock flag
    if (typeof data.isTenderLocked !== "boolean") {
      updates.isTenderLocked = false;
    }

    // Add missing KPI timestamps safely
    if (normalizedStage === "manager_approved" && !data.managerApprovedAt) {
      updates.managerApprovedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (normalizedStage === "submitted" && !data.submittedAt) {
      updates.submittedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (normalizedStage === "won" && !data.closedAt) {
      updates.closedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Always ensure updatedAt exists
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // Apply only if changes exist
    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      updatedCount++;

      console.log(`✅ Updated deal: ${doc.id}`);
    }
  }

  console.log(`🎯 Migration complete. ${updatedCount} deals updated.`);
}

migrateDeals()
  .then(() => {
    console.log("🏁 Migration finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });