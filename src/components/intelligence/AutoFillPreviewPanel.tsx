import type { AutoFillPreview } from "@/lib/pdf/autoFillPreviewEngine";
import type { DocumentIntelligenceResult } from "@/lib/intelligence/documentIntelligenceEngine";
import { empireColors } from "@/theme/empireTheme";

type AutoFillPreviewPanelProps = {
  intelligence: DocumentIntelligenceResult | null;
  preview: AutoFillPreview;
};

export default function AutoFillPreviewPanel({ intelligence, preview }: AutoFillPreviewPanelProps) {
  return (
    <section
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        background: "linear-gradient(140deg, rgba(11,18,32,0.95), rgba(8,29,46,0.95))",
        border: `1px solid ${empireColors.border}`,
        boxShadow: empireColors.primaryGlow,
      }}
    >
      <h3 style={{ marginTop: 0, color: empireColors.primary }}>Auto-fill Preview</h3>

      <div style={{ marginBottom: 10, color: empireColors.textPrimary }}>
        <strong>Registration Numbers:</strong>{" "}
        {intelligence?.extractedFields.registrationNumbers.join(", ") || "None detected"}
      </div>
      <div style={{ marginBottom: 10, color: empireColors.textPrimary }}>
        <strong>Expiry Dates:</strong>{" "}
        {intelligence?.extractedFields.expiryDates.join(", ") || "None detected"}
      </div>

      <div style={{ marginBottom: 10, color: empireColors.textSecondary }}>
        <strong>Flags:</strong> Expired={String(intelligence?.flags.expired ?? false)} | Duplicate
        Pattern={String(intelligence?.flags.duplicatePatternDetected ?? false)} | Confidence=
        {intelligence?.confidenceScore ?? 0}
      </div>

      <pre
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 8,
          overflowX: "auto",
          background: "rgba(2, 6, 23, 0.9)",
          border: `1px solid ${empireColors.primary}`,
          color: empireColors.success,
          fontSize: 12,
        }}
      >
        {JSON.stringify(preview, null, 2)}
      </pre>
    </section>
  );
}
