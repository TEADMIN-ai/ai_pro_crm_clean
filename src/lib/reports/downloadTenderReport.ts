import { jsPDF } from "jspdf";

const logo =
  "data:image/jpeg;base64,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";

function cleanText(value: any): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "")
    .replace(/[^a-zA-Z0-9\s:%.,-]/g, "")
    .trim();
}

type ParsedReport = {
  client: string;
  status: string;
  score: string;
  documents: Array<{ name: string; status: boolean }>;
  suggestions: string[];
  approvedBy: string;
  generatedAt: string;
  generatedBy: string;
  extraSections: Array<{ title: string; lines: string[] }>;
};

function parseDocumentLine(line: string) {
  const sanitizedLine = cleanText(line.replace(/^[\-\s]+/, ""));

  if (!sanitizedLine) {
    return null;
  }

  const segments = sanitizedLine.split(":");
  const rawName = cleanText(segments[0] ?? "Document");
  const rawStatus = cleanText(segments.slice(1).join(":")).toUpperCase();
  const isApproved =
    rawStatus.includes("APPROVED") ||
    rawStatus.includes("READY") ||
    rawStatus.includes("PASS");

  return {
    name: rawName || "Document",
    status: isApproved,
  };
}

function parseTenderReport(reportText: string): ParsedReport {
  const result: ParsedReport = {
    client: "",
    status: "",
    score: "",
    documents: [],
    suggestions: [],
    approvedBy: "",
    generatedAt: "",
    generatedBy: "",
    extraSections: [],
  };

  const lines = reportText
    .split("\n")
    .map((line) => line.replace(/\r/g, "").trim())
    .filter((line) => line && !/^-+$/.test(line));

  let currentSection: "documents" | "suggestions" | null = null;

  for (const rawLine of lines) {
    const line = cleanText(rawLine);

    if (!line || line === "TORQUE EMPIRE" || line === "Tender Readiness Report") {
      continue;
    }

    if (line === "Documents:") {
      currentSection = "documents";
      continue;
    }

    if (line === "AI Recommendations:" || line === "Suggestions:") {
      currentSection = "suggestions";
      continue;
    }

    if (line.startsWith("Client:")) {
      result.client = cleanText(line.slice("Client:".length));
      currentSection = null;
      continue;
    }

    if (line.startsWith("Status:")) {
      result.status = cleanText(line.slice("Status:".length));
      currentSection = null;
      continue;
    }

    if (line.startsWith("Compliance Score:")) {
      result.score = cleanText(line.slice("Compliance Score:".length));
      currentSection = null;
      continue;
    }

    if (line.startsWith("Approved by:")) {
      result.approvedBy = cleanText(line.slice("Approved by:".length));
      currentSection = null;
      continue;
    }

    if (line.startsWith("Date:") || line.startsWith("Generated:")) {
      const prefix = line.startsWith("Date:") ? "Date:" : "Generated:";
      result.generatedAt = cleanText(line.slice(prefix.length));
      currentSection = null;
      continue;
    }

    if (line.startsWith("Generated by:")) {
      result.generatedBy = cleanText(line.slice("Generated by:".length));
      currentSection = null;
      continue;
    }

    if (line.startsWith("Generated by ")) {
      result.generatedBy = cleanText(line.replace("Generated by ", ""));
      currentSection = null;
      continue;
    }

    if (currentSection === "documents") {
      const parsedDocument = parseDocumentLine(line);
      if (parsedDocument) {
        result.documents.push(parsedDocument);
      }
      continue;
    }

    if (currentSection === "suggestions") {
      const suggestion = cleanText(line.replace(/^[\-\s]+/, ""));
      if (suggestion && suggestion.toLowerCase() !== "none") {
        result.suggestions.push(suggestion);
      }
      continue;
    }

    result.extraSections.push({
      title: "Additional Notes",
      lines: [line],
    });
  }

  return result;
}

export function downloadTenderReport(reportText: string) {
  const doc = new jsPDF();
  const report = parseTenderReport(reportText);
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const PRIMARY_COLOR: [number, number, number] = [0, 102, 204];
  const SUCCESS_COLOR: [number, number, number] = [0, 150, 0];
  const DANGER_COLOR: [number, number, number] = [200, 0, 0];
  const MUTED_TEXT: [number, number, number] = [100, 100, 100];
  const LIGHT_FILL: [number, number, number] = [245, 245, 245];
  const HEADER_HEIGHT = 25;
  const FOOTER_Y = 275;
  const LEFT_MARGIN = 20;
  const RIGHT_MARGIN = 20;
  const CONTENT_WIDTH = pageWidth - LEFT_MARGIN - RIGHT_MARGIN;

  let y = 40;

  const drawHeader = () => {
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(0, 0, 210, HEADER_HEIGHT, "F");

    try {
      doc.addImage(logo, "JPEG", 20, 8, 20, 20);
    } catch (e) {
      console.warn("Logo failed to load", e);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Tender Readiness Report", pageWidth / 2, 16, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Corporate Compliance Deliverable", pageWidth / 2, 21, {
      align: "center",
    });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    y = 40;
  };

  const drawFooter = () => {
    doc.setDrawColor(...PRIMARY_COLOR);
    doc.line(20, FOOTER_Y, 190, FOOTER_Y);

    doc.setFontSize(9);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(
      "Torque Empire Pty Ltd | Four Divisions. One Vision. Total Excellence.",
      20,
      282
    );
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
  };

  const ensureSpace = (requiredHeight = 10) => {
    if (y + requiredHeight <= pageHeight - 22) {
      return;
    }

    drawFooter();
    doc.addPage();
    drawHeader();
  };

  const writeWrappedText = (
    text: string,
    x: number,
    maxWidth: number,
    options?: { color?: [number, number, number]; font?: "normal" | "bold" }
  ) => {
    const content = cleanText(text);

    if (!content) {
      return;
    }

    const wrappedLines = doc.splitTextToSize(content, maxWidth) as string[];
    ensureSpace(Math.max(8, wrappedLines.length * 6));

    doc.setTextColor(...(options?.color ?? [0, 0, 0]));
    doc.setFont("helvetica", options?.font ?? "normal");
    doc.text(wrappedLines, x, y);
    y += wrappedLines.length * 6;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(12);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(cleanText(title), LEFT_MARGIN, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };

  drawHeader();

  doc.setFillColor(...LIGHT_FILL);
  doc.roundedRect(20, y - 5, 170, 24, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.text(`Client: ${cleanText(report.client) || "Not Provided"}`, 25, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_TEXT);
  doc.setFontSize(10);
  doc.text(
    `Prepared for external distribution | ${cleanText(report.generatedAt) || cleanText(new Date().toLocaleString())}`,
    25,
    y + 10
  );
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  y += 26;

  addSectionTitle("Compliance Summary");
  const isReady = /READY/i.test(report.status) && !/NOT READY/i.test(report.status);
  const scoreLabel = cleanText(report.score) || "0%";
  const readinessLabel = cleanText(report.status) || (isReady ? "READY" : "NOT READY");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(isReady ? SUCCESS_COLOR : DANGER_COLOR));
  doc.setFontSize(18);
  doc.text(`${scoreLabel} (${readinessLabel})`, LEFT_MARGIN, y + 2);
  doc.setFontSize(11);
  y += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  writeWrappedText(
    isReady
      ? "The tender pack is positioned for client-ready submission, subject to final commercial review."
      : "The tender pack requires remediation before distribution to ensure compliance completeness."
    ,
    LEFT_MARGIN,
    CONTENT_WIDTH
  );
  y += 4;

  addSectionTitle("Document Breakdown");
  if (report.documents.length === 0) {
    writeWrappedText("No documents were provided in the generated report.", LEFT_MARGIN, CONTENT_WIDTH);
  } else {
    for (const docItem of report.documents) {
      const statusColor = docItem.status ? SUCCESS_COLOR : DANGER_COLOR;
      const statusLabel = docItem.status ? "APPROVED" : "MISSING";
      writeWrappedText(`- ${docItem.name}: ${statusLabel}`, LEFT_MARGIN, CONTENT_WIDTH, {
        color: statusColor,
      });
    }
  }
  y += 4;

  addSectionTitle("AI Recommendations");
  if (report.suggestions.length === 0) {
    writeWrappedText("No additional AI recommendations were supplied.", LEFT_MARGIN, CONTENT_WIDTH);
  } else {
    for (const suggestion of report.suggestions) {
      writeWrappedText(`- ${suggestion}`, LEFT_MARGIN, CONTENT_WIDTH);
    }
  }

  if (report.extraSections.length > 0) {
    y += 4;
    addSectionTitle("Additional Notes");
    for (const extraSection of report.extraSections) {
      for (const line of extraSection.lines) {
        writeWrappedText(line, LEFT_MARGIN, CONTENT_WIDTH);
      }
    }
  }

  y += 10;
  addSectionTitle("Approval");
  writeWrappedText(
    `Approved by: ${cleanText(report.approvedBy) || "Torque Empire System"}`,
    LEFT_MARGIN,
    CONTENT_WIDTH,
    { font: "bold" }
  );
  writeWrappedText(
    `Generated: ${cleanText(report.generatedAt) || cleanText(new Date().toLocaleString())}`,
    LEFT_MARGIN,
    CONTENT_WIDTH
  );
  writeWrappedText(
    `Issued by: ${cleanText(report.generatedBy) || "Torque Empire System"}`,
    LEFT_MARGIN,
    CONTENT_WIDTH
  );

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFooter();
  }

  doc.save("Torque_Empire_Tender_Report.pdf");
}
