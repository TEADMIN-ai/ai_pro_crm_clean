"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { Contractor } from "@/types/contractor";

type ComplianceRadarProps = {
  contractorId: string;
  refreshKey?: string | number;
};

type RadarPayload = Contractor & {
  success?: boolean;
  error?: string;
};

type RadarStatus = "Tender Ready" | "Almost Ready" | "Compliance Incomplete";

const toneMap = {
  ready: {
    color: "#22c55e",
    glow: "0 0 22px rgba(34,197,94,0.28)",
    track: "rgba(20,83,45,0.34)",
    border: "rgba(34,197,94,0.42)",
    badge: "success" as const,
  },
  warning: {
    color: "#facc15",
    glow: "0 0 22px rgba(250,204,21,0.24)",
    track: "rgba(133,77,14,0.34)",
    border: "rgba(250,204,21,0.38)",
    badge: "warning" as const,
  },
  danger: {
    color: "#ef4444",
    glow: "0 0 22px rgba(239,68,68,0.24)",
    track: "rgba(127,29,29,0.34)",
    border: "rgba(239,68,68,0.4)",
    badge: "danger" as const,
  },
} as const;

function clampScore(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function getStatus(readinessScore: number): RadarStatus {
  if (readinessScore >= 80) {
    return "Tender Ready";
  }

  if (readinessScore >= 60) {
    return "Almost Ready";
  }

  return "Compliance Incomplete";
}

function getTone(readinessScore: number) {
  if (readinessScore >= 80) {
    return toneMap.ready;
  }

  if (readinessScore >= 60) {
    return toneMap.warning;
  }

  return toneMap.danger;
}

function getLockCopy(isTenderLocked: boolean, readinessScore: number): string {
  if (isTenderLocked) {
    return "Locked";
  }

  return readinessScore >= 80 ? "Tender Ready" : "Tender Unlocked";
}

export default function ComplianceRadar({ contractorId, refreshKey }: ComplianceRadarProps) {
  const [contractor, setContractor] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRadar() {
      setLoading(true);
      setError(null);

      try {
        const response = await authFetch(API_ROUTES.CONTRACTOR_DETAIL(contractorId));
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const payload = (await response.json()) as RadarPayload;
        if (!active) {
          return;
        }

        if (!payload?.id) {
          throw new Error(payload.error ?? "Invalid contractor payload");
        }

        setContractor(payload);
      } catch (loadError) {
        if (!active) {
          return;
        }

        console.error("Compliance radar load error:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load compliance radar");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRadar();

    return () => {
      active = false;
    };
  }, [contractorId, refreshKey]);

  const readinessScore = clampScore(contractor?.readinessScore);
  const docsMissing = typeof contractor?.docsMissing === "number" ? Math.max(0, contractor.docsMissing) : 0;
  const isTenderLocked = contractor?.isTenderLocked ?? readinessScore < 80;
  const status = getStatus(readinessScore);
  const tone = getTone(readinessScore);
  const progress = `${readinessScore}%`;
  const lockLabel = isTenderLocked ? "Tender Locked" : readinessScore >= 80 ? "Tender Ready" : "Tender Unlocked";
  const lockGlyph = isTenderLocked ? "\uD83D\uDD12" : "\uD83D\uDD13";

  return (
    <Card
      className="intelligence-card"
    >
      <section
        style={{
          borderRadius: 16,
          border: `1px solid ${tone.border}`,
          background:
            "linear-gradient(145deg, rgba(5,10,20,0.96) 0%, rgba(11,18,32,0.93) 46%, rgba(15,23,42,0.96) 100%)",
          boxShadow: `${tone.glow}, inset 0 0 30px rgba(0,240,255,0.06)`,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: "#94A3B8" }}>
              Compliance Radar
            </p>
            <h2 style={{ margin: "8px 0 0", fontSize: 28, color: "#F8FAFC" }}>
              {loading ? "Loading..." : `${readinessScore}%`}
            </h2>
          </div>
          <Badge tone={tone.badge}>{loading ? "Syncing" : status}</Badge>
        </div>

        {error ? (
          <p style={{ margin: "14px 0 0", color: "#FCA5A5" }}>{error}</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              alignItems: "center",
              marginTop: 18,
            }}
          >
            <div style={{ display: "grid", placeItems: "center" }}>
              <div
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: "50%",
                  background: `conic-gradient(${tone.color} ${progress}, ${tone.track} ${progress})`,
                  boxShadow: tone.glow,
                  display: "grid",
                  placeItems: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 126,
                    height: 126,
                    borderRadius: "50%",
                    border: "1px solid rgba(148,163,184,0.18)",
                    background:
                      "radial-gradient(circle at 30% 30%, rgba(15,23,42,0.98), rgba(2,6,23,0.98) 74%)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "inset 0 0 24px rgba(0,240,255,0.08)",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 34, fontWeight: 800, color: "#F8FAFC", lineHeight: 1 }}>{readinessScore}%</div>
                    <div style={{ marginTop: 6, fontSize: 11, letterSpacing: 0.45, textTransform: "uppercase", color: "#94A3B8" }}>
                      Score
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(0,240,255,0.18)",
                  background: "linear-gradient(160deg, rgba(15,23,42,0.76), rgba(10,14,25,0.92))",
                  padding: 14,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.45, color: "#94A3B8" }}>
                  Documents Missing
                </p>
                <p style={{ margin: "10px 0 0", fontSize: 30, fontWeight: 800, color: "#F8FAFC" }}>{loading ? "-" : docsMissing}</p>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${tone.border}`,
                  background: "linear-gradient(160deg, rgba(15,23,42,0.76), rgba(10,14,25,0.92))",
                  padding: 14,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.45, color: "#94A3B8" }}>
                  Tender Status
                </p>
                <p style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 800, color: tone.color }}>
                  {loading ? "Syncing..." : `${lockGlyph} ${lockLabel}`}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#CBD5E1" }}>
                  {loading ? "Refreshing contractor compliance state." : getLockCopy(isTenderLocked, readinessScore)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </Card>
  );
}
