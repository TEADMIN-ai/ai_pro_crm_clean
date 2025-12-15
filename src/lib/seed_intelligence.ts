// src/lib/seed_intelligence.ts
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// === Locate and load credentials ===
const serviceAccountPath = path.resolve(process.cwd(), "firebase-adminsdk.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Firebase credential file not found:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// === Initialize Firebase Admin ===
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://torque-empire-ai-pro-crm.firebaseio.com"
  });
}

const db = admin.firestore();

// === Example Intelligence Data Seed ===
const data = {
  strategy: {
    aggressiveBidding: {
      title: "Aggressive Bidding",
      description: "Lower prices, higher win probability"
    },
    aiOptimization: {
      title: "AI Proposal Optimization",
      description: "Use data-driven scoring to boost evaluations"
    },
    partnershipExpansion: {
      title: "Partnership Expansion",
      description: "Team with SMEs for compliance and reach"
    }
  },
  competitors: [
    {
      name: "BuildCore Pty",
      strengths: "Low cost structure, good project turnaround",
      weaknesses: "Inconsistent documentation, late compliance uploads"
    },
    {
      name: "NovaTend Solutions",
      strengths: "AI-driven evaluation scoring, strong technical team",
      weaknesses: "High operational overhead, limited local presence"
    },
    {
      name: "EmpireBid Consortium",
      strengths: "High B-BBEE rating, excellent tender presentation",
      weaknesses: "Overextended pipeline, possible delays in handover"
    }
  ]
};

async function seed() {
  const batch = db.batch();

  const strategyRef = db.collection("intelligence").doc("strategy");
  batch.set(strategyRef, data.strategy);

  const competitorsRef = db.collection("intelligence").doc("competitors");
  batch.set(competitorsRef, { list: data.competitors });

  await batch.commit();
  console.log("🔥 Live intelligence data seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});