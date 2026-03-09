"use client";

import type { DocumentIntelligenceResult } from "@/lib/intelligence/documentIntelligenceEngine";
import type { DocumentAnalysis } from "@/types/tenderAudit";

type DocumentIntelligenceProps = {
  analysis: DocumentIntelligenceResult | DocumentAnalysis | null;
};

function getConfidenceScore(analysis: DocumentIntelligenceResult | DocumentAnalysis | null) {
  if (!analysis) {
    return 0;
  }

  if ("confidenceScore" in analysis) {
    return analysis.confidenceScore;
  }

  return analysis.confidence ?? 0;
}

function getExpired(analysis: DocumentIntelligenceResult | DocumentAnalysis | null) {
  if (!analysis) {
    return false;
  }

  if ("flags" in analysis) {
    return analysis.flags.expired;
  }

  return analysis.expired ?? false;
}

function getDuplicate(analysis: DocumentIntelligenceResult | DocumentAnalysis | null) {
  if (!analysis) {
    return false;
  }

  if ("flags" in analysis) {
    return analysis.flags.duplicatePatternDetected;
  }

  return analysis.duplicate ?? false;
}

function getRegistrationNumbers(analysis: DocumentIntelligenceResult | DocumentAnalysis | null) {
  if (!analysis) {
    return [] as string[];
  }

  if ("extractedFields" in analysis) {
    return analysis.extractedFields.registrationNumbers;
  }

  return analysis.registrationNumber ? [analysis.registrationNumber] : [];
}

function getExpiryDates(analysis: DocumentIntelligenceResult | DocumentAnalysis | null) {
  if (!analysis) {
    return [] as string[];
  }

  if ("extractedFields" in analysis) {
    return analysis.extractedFields.expiryDates;
  }

  return analysis.expiryDate ? [analysis.expiryDate] : [];
}

function renderList(values: string[]) {
  if (values.length === 0) {
    return <p style={{ margin: "8px 0 0", opacity: 0.7 }}>None detected</p>;
  }

  return (
    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
      {values.map((value) => (
        <li key={value} style={{ marginBottom: 4 }}>
          {value}
        </li>
      ))}
    </ul>
  );
}

export default function DocumentIntelligence({ analysis }: DocumentIntelligenceProps) {
  return (
    <section
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #1E293B",
        background: "#0F172A",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 12 }}>Confidence</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>
            {getConfidenceScore(analysis)}%
          </p>
        </div>
        <div>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 12 }}>Expired Documents</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>
            {getExpired(analysis) ? "Yes" : "No"}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 12 }}>Duplicate Patterns</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>
            {getDuplicate(analysis) ? "Detected" : "Clear"}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          marginTop: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Registration Numbers</h3>
          {renderList(getRegistrationNumbers(analysis))}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Expiry Dates</h3>
          {renderList(getExpiryDates(analysis))}
        </div>
      </div>
    </section>
  );
}
