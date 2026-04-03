"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { DOCUMENT_LABELS } from "@/lib/constants/documentTypes";
import { API_ROUTES } from "@/lib/routes";

type Deal = {
  id: string;
  title?: string;
  type?: string;
  status?: string;
  contractorId?: string;
  readinessStatus?: "READY" | "AT_RISK" | "LOCKED";
  readinessScore?: number;
  isTenderLocked?: boolean;
  docsMissing?: string[];
  templateOverride?: string[] | null;
};

type PreviewData = {
  success?: boolean;
  templates: string[];
  templateCount?: number;
  dealType?: string;
};

const TEMPLATE_OPTIONS = ["SBD1", "SBD4", "SBD6", "SBD8", "SBD9"] as const;

function getTemplates(deal: Deal) {
  if (Array.isArray(deal.templateOverride) && deal.templateOverride.length > 0) {
    return deal.templateOverride;
  }

  if (deal.type === "private") {
    return ["SBD1", "SBD4"];
  }

  return ["SBD1", "SBD4", "SBD6", "SBD8", "SBD9"];
}

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewDealId, setPreviewDealId] = useState<string | null>(null);

  // ============================
  // 🔹 STATUS COLORS
  // ============================
  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "approved":
        return { background: "#d4edda", color: "#155724" };
      case "rejected":
        return { background: "#f8d7da", color: "#721c24" };
      default:
        return { background: "#fff3cd", color: "#856404" }; // draft
    }
  };

  const getReadinessStyle = (status?: string) => {
    switch (status) {
      case "READY":
        return { background: "#d4edda", color: "#155724" };
      case "AT_RISK":
        return { background: "#fff3cd", color: "#856404" };
      default:
        return { background: "#f8d7da", color: "#721c24" };
    }
  };

  const downloadPdfBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // ============================
  // 🔹 FETCH DEALS
  // ============================
  const fetchDeals = async () => {
    try {
      setLoading(true);
      setError(null);

      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) throw new Error("User not logged in");

      const token = await user.getIdToken();

      // TEMP role decode (dev only)
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        setRole(decoded.role || null);
      } catch {
        setRole(null);
      }

      const res = await fetch(API_ROUTES.DEALS, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch deals");
      }

      const data = await res.json();
      setDeals(data.deals || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // 🔹 UPDATE STATUS
  // ============================
  const updateStatus = async (dealId: string, status: string) => {
    const confirmAction = confirm(
      `Are you sure you want to ${status} this deal?`
    );

    if (!confirmAction) return;

    try {
      setUpdatingId(dealId);

      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) throw new Error("User not logged in");

      const token = await user.getIdToken();

      const res = await fetch(API_ROUTES.DEAL_DETAIL(dealId), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      await fetchDeals();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const generateTenderPack = async (deal: Deal) => {
    if (deal.isTenderLocked) return;

    try {
      setGeneratingId(deal.id);

      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) throw new Error("User not logged in");

      const token = await user.getIdToken();
      const res = await fetch(API_ROUTES.TENDER_PACK(deal.id), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate tender pack");
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error("Tender pack was generated without a file payload");
      }

      downloadPdfBlob(blob, `${deal.title || "deal"}-tender-pack.pdf`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to generate tender pack");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleTemplateToggle = async (dealId: string, template: string, checked: boolean) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not logged in");
      }

      const token = await user.getIdToken();
      const res = await fetch(API_ROUTES.DEAL_TEMPLATES(dealId), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ template, checked }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update templates");
      }

      await fetchDeals();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to update templates");
    }
  };

  const handlePreview = async (dealId: string) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not logged in");
      }

      const token = await user.getIdToken();
      const res = await fetch(API_ROUTES.TENDER_PACK_PREVIEW(dealId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as PreviewData & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load preview");
      }

      setPreviewData({
        templates: data.templates ?? [],
        templateCount: data.templateCount,
        dealType: data.dealType,
        success: data.success,
      });
      setPreviewDealId(dealId);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load preview");
    }
  };

  const handlePreviewPDF = async (dealId: string) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not logged in");
      }

      const token = await user.getIdToken();
      const res = await fetch(API_ROUTES.TENDER_PACK_PREVIEW_PDF(dealId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load preview PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load preview PDF");
    }
  };

  // ============================
  // 🔹 LOAD PAGE
  // ============================
  useEffect(() => {
    fetchDeals();
  }, []);

  // ============================
  // 🔹 UI
  // ============================
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>
        My Deals
      </h1>

      {error && (
        <p style={{ color: "red", marginTop: "10px" }}>{error}</p>
      )}

      {loading ? (
        <p>Loading deals...</p>
      ) : deals.length === 0 ? (
        <p>No deals found</p>
      ) : (
        <div style={{ marginTop: "20px" }}>
          {deals.map((deal) => {
            const isFinal =
              deal.status === "approved" || deal.status === "rejected";

            return (
              <div
                key={deal.id}
                style={{
                  padding: "16px",
                  marginBottom: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  background: "#fff",
                }}
              >
                <strong>{deal.title || "Untitled Deal"}</strong>

                <div style={{ marginTop: "6px" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      ...getStatusStyle(deal.status),
                    }}
                  >
                    {deal.status || "draft"}
                  </span>
                </div>

                <div style={{ marginTop: "6px" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      marginTop: "6px",
                      ...getReadinessStyle(deal.readinessStatus),
                    }}
                  >
                    {deal.readinessStatus || "LOCKED"}
                    {typeof deal.readinessScore === "number" ? ` (${deal.readinessScore}%)` : ""}
                  </span>
                </div>

                {deal.readinessStatus === "LOCKED" && (
                  <p style={{ color: "red", marginTop: "6px" }}>
                    Cannot submit - missing or rejected documents
                  </p>
                )}

                {deal.readinessStatus === "LOCKED" && (
                  <p style={{ color: "red", marginTop: "6px" }}>
                    Some documents were rejected. Please re-upload corrected versions.
                  </p>
                )}

                {deal.readinessStatus === "LOCKED" && (deal.docsMissing?.length ?? 0) > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <strong style={{ color: "red" }}>Missing Documents:</strong>
                    <p style={{ marginTop: "6px", marginBottom: "6px" }}>
                      {deal.docsMissing?.length} documents required to unlock submission
                    </p>
                    <ul>
                      {deal.docsMissing?.map((doc) => (
                        <li key={doc}>🔴 {DOCUMENT_LABELS[doc] || doc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {deal.readinessStatus === "AT_RISK" && (
                  <p style={{ color: "#856404", marginTop: "6px" }}>
                    Some documents are still under review
                  </p>
                )}

                {deal.readinessStatus === "READY" && (
                  <p style={{ color: "green", marginTop: "6px" }}>
                    Ready for tender submission
                  </p>
                )}

                <div style={{ marginTop: "10px" }}>
                  <strong>Templates:</strong>
                  <div style={{ marginTop: "6px" }}>{getTemplates(deal).join(", ")}</div>
                </div>

                <button
                  type="button"
                  disabled={deal.isTenderLocked || generatingId === deal.id}
                  onClick={() => {
                    if (deal.isTenderLocked) return;
                    void generateTenderPack(deal);
                  }}
                  style={{
                    marginTop: "10px",
                    opacity: deal.isTenderLocked || generatingId === deal.id ? 0.5 : 1,
                    cursor:
                      deal.isTenderLocked || generatingId === deal.id ? "not-allowed" : "pointer",
                  }}
                >
                  {generatingId === deal.id
                    ? "Generating..."
                    : deal.isTenderLocked
                      ? "Locked - Fix Documents First"
                      : "Generate Tender Pack"}
                </button>

                <button
                  type="button"
                  onClick={() => void handlePreview(deal.id)}
                  style={{ marginTop: "10px", marginLeft: "10px" }}
                >
                  Preview Pack
                </button>

                {deal.readinessStatus === "LOCKED" && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/documents")}
                    style={{ marginTop: "10px", marginLeft: "10px" }}
                  >
                    Upload Required Documents
                  </button>
                )}

                {role === "admin" && (
                  <div style={{ marginTop: "12px" }}>
                    <strong>Template Override</strong>
                    {TEMPLATE_OPTIONS.map((tpl) => (
                      <label key={tpl} style={{ display: "block", marginTop: "4px" }}>
                        <input
                          type="checkbox"
                          checked={deal.templateOverride?.includes(tpl) || false}
                          onChange={(event) =>
                            void handleTemplateToggle(deal.id, tpl, event.target.checked)
                          }
                        />{" "}
                        {tpl}
                      </label>
                    ))}
                  </div>
                )}

                {/* ACTIONS */}
                {!isFinal &&
                  ["admin", "staff", "manager"].includes(role || "") && (
                    <div style={{ marginTop: "10px" }}>
                      <button
                        onClick={() =>
                          updateStatus(deal.id, "approved")
                        }
                        disabled={updatingId === deal.id}
                        style={{
                          marginRight: "10px",
                          opacity:
                            updatingId === deal.id ? 0.6 : 1,
                        }}
                      >
                        {updatingId === deal.id
                          ? "Processing..."
                          : "Approve"}
                      </button>

                      <button
                        onClick={() =>
                          updateStatus(deal.id, "rejected")
                        }
                        disabled={updatingId === deal.id}
                        style={{
                          opacity:
                            updatingId === deal.id ? 0.6 : 1,
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {previewOpen && previewData && previewDealId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            }}
          >
            <h3>Template Preview</h3>
            <p>
              <strong>Deal Type:</strong> {previewData.dealType || "unknown"}
            </p>
            <p>
              <strong>Template Count:</strong> {previewData.templateCount ?? previewData.templates.length}
            </p>
            <ul>
              {previewData.templates.map((tpl) => (
                <li key={tpl}>{tpl}</li>
              ))}
            </ul>
            <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
              <button type="button" onClick={() => void handlePreviewPDF(previewDealId)}>
                View PDF Preview
              </button>
              <button type="button" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
