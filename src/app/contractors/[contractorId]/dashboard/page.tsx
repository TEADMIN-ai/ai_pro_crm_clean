"use client";

import { useEffect, useState } from "react";
import { listenContractorData } from "@/lib/firestore"; // ✅ Corrected import
import { useParams } from "next/navigation";

export default function ContractorDashboard() {
  const params = useParams();
  const contractorId = params?.contractorId as string;

  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId) return;

    try {
      // 🔥 Real-time Firestore listener
      const unsub = listenContractorData(contractorId, (data) => {
        setTenders(data || []);
        setLoading(false);
      });

      return () => unsub && unsub();
    } catch (err: any) {
      console.error("❌ Error loading contractor data:", err);
      setError("Unable to load data. Please check your Firestore permissions.");
      setLoading(false);
    }
  }, [contractorId]);

  if (loading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>⚙️ Loading your dashboard...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>❌ Error</h2>
        <p style={styles.text}>{error}</p>
      </div>
    );
  }

  if (tenders.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>📄 No tenders found</h2>
        <p style={styles.text}>Once tenders are available, they will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>🚀 Contractor Dashboard</h1>
      <p style={styles.subtitle}>Welcome to your Torque Empire Portal</p>

      <div style={styles.cardContainer}>
        {tenders.map((tender) => (
          <div key={tender.id} style={styles.card}>
            <h3 style={styles.cardTitle}>{tender.title || "Untitled Tender"}</h3>
            <p style={styles.cardText}>
              🧾 Status: <strong>{tender.status || "Unknown"}</strong>
            </p>
            <p style={styles.cardText}>
              📅 Last updated:{" "}
              {tender.updatedAt
                ? new Date(tender.updatedAt.seconds * 1000).toLocaleString()
                : "No date"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    background: "#020d16",
    color: "white",
    minHeight: "100vh",
    padding: "2rem",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    fontSize: "2rem",
    color: "#00ffff",
    marginBottom: "0.5rem",
  },
  subtitle: {
    fontSize: "1rem",
    marginBottom: "2rem",
    color: "#8ecae6",
  },
  title: {
    color: "#00ffff",
    textAlign: "center",
  },
  text: {
    textAlign: "center",
    color: "#ccc",
  },
  cardContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1.5rem",
  },
  card: {
    background: "#041c29",
    padding: "1rem",
    borderRadius: "12px",
    boxShadow: "0 0 12px rgba(0, 255, 255, 0.2)",
    transition: "transform 0.2s ease",
  },
  cardTitle: {
    color: "#00ffff",
    fontSize: "1.2rem",
    marginBottom: "0.5rem",
  },
  cardText: {
    color: "#ccc",
    marginBottom: "0.3rem",
  },
};