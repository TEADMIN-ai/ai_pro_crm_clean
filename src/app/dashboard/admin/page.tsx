import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { computeAdminMetrics } from "@/lib/utils/admin/getAdminMetrics";
import type { Deal } from "@/types/deal";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export default async function AdminDashboard() {
  const db = getFirestore();

  const snapshot = await db.collection("deals").get();
  const deals: Deal[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Deal[];

  const metrics = computeAdminMetrics(deals);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
        Admin Control Tower
      </h1>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Card title="Total Deals" value={metrics.totalDeals} />
        <Card title="Total Pipeline Value" value={`R ${metrics.totalPipelineValue.toLocaleString()}`} />
        <Card title="Weighted Revenue" value={`R ${metrics.weightedRevenue.toLocaleString()}`} />
        <Card title="Locked Deals" value={metrics.lockedDeals} />
        <Card title="Unassigned Deals" value={metrics.unassignedDeals} />
      </div>

      <h2 style={{ marginTop: 40, marginBottom: 16 }}>Stage Distribution</h2>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {Object.entries(metrics.stageCounts).map(([stage, count]) => (
          <Card key={stage} title={stage} value={count} />
        ))}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: "1px solid #ddd",
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 14, color: "#64748b" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}