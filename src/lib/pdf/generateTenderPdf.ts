import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, degrees, rgb, type RGB } from "pdf-lib";

type ComplianceStatus = "verified" | "missing" | "expired" | "warning";

type ComplianceChecklistItem = {
  key: string;
  label: string;
  status: ComplianceStatus;
  detail: string;
};

type ComplianceDocumentState = {
  valid?: boolean;
  uploaded?: boolean;
  status?: string;
  documentType?: string;
};

type ComplianceIntelligence = {
  riskGrade?: string | null;
  explainableSummary?: string | null;
  blockedReasons?: string[] | null;
  reviewRecommendations?: string[] | null;
  documentBreakdown?: Array<{
    documentType?: string;
    label?: string;
    status?: string;
    reason?: string | null;
    suggestions?: string[];
  }> | null;
};

type ComplianceSummary = {
  readinessScore?: number | null;
  tenderLockStatus?: "READY" | "RISK" | "BLOCKED" | string | null;
  complianceApproved?: boolean | null;
  riskGrade?: string | null;
  docsMissing?: number | null;
  missingDocumentTypes?: string[] | null;
  expiredDocumentCount?: number | null;
  legacyDocuments?: Record<string, ComplianceDocumentState> | null;
  intelligence?: ComplianceIntelligence | null;
};

type TenderDealData = {
  id: string;
  title: string;
  value: number | null;
  readinessScore?: number | null;
  missingDocs?: string[];
  missingRequirements?: string[];
  riskLevel?: string | null;
  riskGrade?: string | null;
  tenderLockStatus?: string | null;
  complianceApproved?: boolean | null;
  suggestions?: string[];
  status?: string | null;
  compliance?: ComplianceSummary | null;
  intelligence?: ComplianceIntelligence | null;
};

type TenderContractorData = {
  id: string;
  companyName: string;
  name?: string | null;
  registrationNumber?: string | null;
  companyRegistrationNumber?: string | null;
  csdNumber?: string | null;
  contactPerson?: string | null;
  contactName?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  contactPhone?: string | null;
  telephone?: string | null;
  bbbeeStatus?: string | null;
  directorName?: string | null;
  logoBase64?: string | null;
  readinessScore?: number | null;
  tenderLockStatus?: string | null;
  complianceApproved?: boolean | null;
  riskGrade?: string | null;
  docsMissing?: number | null;
  missingDocumentTypes?: string[] | null;
  missingCriticalDocuments?: string[] | null;
  explainableSummary?: string | null;
  blockedReasons?: string[] | null;
  reviewRecommendations?: string[] | null;
  complianceDocumentBreakdown?: ComplianceIntelligence["documentBreakdown"];
  documents?: Record<string, ComplianceDocumentState> | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PRIMARY = rgb(0.05, 0.12, 0.22);
const ACCENT = rgb(0.04, 0.42, 0.56);
const GOLD = rgb(0.87, 0.58, 0.12);
const GREEN = rgb(0.08, 0.48, 0.26);
const RED = rgb(0.72, 0.16, 0.16);
const AMBER = rgb(0.82, 0.47, 0.08);
const DIVIDER = rgb(0.79, 0.84, 0.89);
const PANEL = rgb(0.95, 0.97, 0.99);
const BODY = rgb(0.09, 0.11, 0.14);
const MUTED = rgb(0.42, 0.48, 0.56);
const WHITE = rgb(1, 1, 1);
const FOOTER_BRAND = "Torque Empire PTY LTD | Four Divisions. One Vision. Total Excellence.";

const CHECKLIST = [
  { key: "cipc", label: "CIPC" },
  { key: "bbbee", label: "B-BBEE" },
  { key: "tax", label: "Tax Clearance", aliases: ["taxClearance"] },
  { key: "coida", label: "COIDA" },
  { key: "bank", label: "Bank Confirmation", aliases: ["bankConfirmation"] },
];

function asString(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampPercent(value: number | null | undefined): number {
  return Math.max(0, Math.min(100, Math.round(typeof value === "number" && Number.isFinite(value) ? value : 0)));
}

function titleCaseToken(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeBase64Image(input?: string | null): Uint8Array | null {
  if (!input) {
    return null;
  }

  const normalized = input.includes(",") ? input.split(",").pop() ?? "" : input;
  return normalized ? Uint8Array.from(Buffer.from(normalized, "base64")) : null;
}

async function loadLogoBytes(logoBase64?: string | null): Promise<Uint8Array | null> {
  const inlineLogo = normalizeBase64Image(logoBase64);
  if (inlineLogo) {
    return inlineLogo;
  }

  try {
    return Uint8Array.from(await readFile(path.join(process.cwd(), "public", "logo.png")));
  } catch {
    return null;
  }
}

function drawFooter(page: PDFPage, text: string, font: PDFFont, pageNumber: number) {
  page.drawLine({
    start: { x: MARGIN, y: 34 },
    end: { x: PAGE_WIDTH - MARGIN, y: 34 },
    thickness: 0.8,
    color: DIVIDER,
  });

  page.drawText(FOOTER_BRAND, {
    x: MARGIN,
    y: 18,
    size: 8,
    font,
    color: MUTED,
  });

  page.drawText(text, {
    x: MARGIN,
    y: 7,
    size: 7,
    font,
    color: MUTED,
  });

  page.drawText(`Page ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN - 36,
    y: 18,
    size: 8,
    font,
    color: MUTED,
  });
}

function drawReadinessGauge(
  page: PDFPage,
  score: number,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  boldFont: PDFFont,
) {
  const clampedScore = clampPercent(score);
  const height = 16;
  const fillWidth = Math.max(0, Math.min(width, (clampedScore / 100) * width));
  const fillColor = clampedScore >= 80 ? GREEN : clampedScore >= 60 ? AMBER : RED;

  page.drawText("Readiness Gauge", {
    x,
    y: y + 22,
    size: 10,
    font: boldFont,
    color: PRIMARY,
  });
  page.drawRectangle({ x, y, width, height, color: rgb(0.9, 0.94, 0.97), borderColor: DIVIDER, borderWidth: 0.8 });
  page.drawRectangle({ x, y, width: fillWidth, height, color: fillColor });
  [0, 25, 50, 75, 100].forEach((tick) => {
    const tickX = x + (tick / 100) * width;
    page.drawLine({ start: { x: tickX, y: y - 3 }, end: { x: tickX, y: y + height + 3 }, thickness: 0.5, color: DIVIDER });
    page.drawText(String(tick), { x: tickX - 5, y: y - 17, size: 7, font, color: MUTED });
  });
  page.drawText(`${clampedScore}%`, {
    x: x + width + 12,
    y: y - 1,
    size: 17,
    font: boldFont,
    color: fillColor,
  });
}

function drawCoverPage(params: {
  page: PDFPage;
  deal: TenderDealData;
  contractor: TenderContractorData;
  readinessScore: number;
  riskGrade: string;
  tenderStatus: string;
  generatedAt: string;
  recommendation: { label: string; color: RGB };
  font: PDFFont;
  boldFont: PDFFont;
}) {
  const { page, deal, contractor, readinessScore, riskGrade, tenderStatus, generatedAt, recommendation, font, boldFont } = params;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PRIMARY });
  page.drawRectangle({ x: 0, y: 0, width: 18, height: PAGE_HEIGHT, color: GOLD });
  page.drawText("TORQUE EMPIRE", { x: MARGIN + 18, y: 760, size: 15, font: boldFont, color: GOLD });
  page.drawText("Contractor Tender Pack", { x: MARGIN + 18, y: 704, size: 32, font: boldFont, color: WHITE });
  drawWrappedText(page, deal.title || deal.id, MARGIN + 20, 674, CONTENT_WIDTH - 40, font, 13, rgb(0.82, 0.89, 0.96), 17);

  page.drawRectangle({ x: MARGIN + 18, y: 436, width: CONTENT_WIDTH - 36, height: 178, color: rgb(0.94, 0.97, 1), opacity: 0.98 });
  page.drawText("CONTRACTOR", { x: MARGIN + 38, y: 576, size: 8, font: boldFont, color: MUTED });
  page.drawText(contractor.companyName || contractor.name || "N/A", { x: MARGIN + 38, y: 548, size: 20, font: boldFont, color: PRIMARY });
  page.drawText("Company Name", { x: MARGIN + 38, y: 520, size: 8, font: boldFont, color: MUTED });
  drawWrappedText(page, contractor.companyName || "N/A", MARGIN + 38, 500, CONTENT_WIDTH - 96, font, 11, BODY, 14);
  page.drawText("Tender Status", { x: MARGIN + 38, y: 468, size: 8, font: boldFont, color: MUTED });
  page.drawText(tenderStatus, { x: MARGIN + 38, y: 448, size: 13, font: boldFont, color: PRIMARY });
  page.drawText("Generated Date", { x: MARGIN + 255, y: 468, size: 8, font: boldFont, color: MUTED });
  page.drawText(generatedAt, { x: MARGIN + 255, y: 448, size: 13, font, color: PRIMARY });

  page.drawRectangle({ x: MARGIN + 18, y: 314, width: CONTENT_WIDTH - 36, height: 72, color: recommendation.color });
  page.drawText("SUBMISSION BADGE", { x: MARGIN + 38, y: 360, size: 8, font: boldFont, color: rgb(0.94, 0.98, 1) });
  page.drawText(recommendation.label, { x: MARGIN + 38, y: 334, size: 24, font: boldFont, color: WHITE });

  drawMetricBox(page, MARGIN + 18, 270, 150, "READINESS SCORE", `${readinessScore}%`, ACCENT, font, boldFont);
  drawMetricBox(page, MARGIN + 188, 270, 150, "RISK GRADE", riskGrade || "REVIEW", GOLD, font, boldFont);
  drawMetricBox(page, MARGIN + 358, 270, 150, "TENDER STATUS", tenderStatus || "PENDING", recommendation.color, font, boldFont);
  drawReadinessGauge(page, readinessScore, MARGIN + 18, 154, CONTENT_WIDTH - 120, font, boldFont);
}

function drawWatermark(page: PDFPage, font: PDFFont) {
  const text = "Torque Empire";
  const size = 48;
  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: PAGE_HEIGHT / 2,
    size,
    font,
    color: PRIMARY,
    opacity: 0.045,
    rotate: degrees(-20),
  });
}

function drawHeader(page: PDFPage, title: string, subtitle: string, font: PDFFont, boldFont: PDFFont) {
  page.drawRectangle({ x: 0, y: 746, width: PAGE_WIDTH, height: 96, color: PRIMARY });
  page.drawRectangle({ x: 0, y: 746, width: 11, height: 96, color: GOLD });

  page.drawText("TORQUE EMPIRE", {
    x: MARGIN,
    y: 806,
    size: 10,
    font: boldFont,
    color: GOLD,
  });

  page.drawText(title, {
    x: MARGIN,
    y: 781,
    size: 22,
    font: boldFont,
    color: WHITE,
  });

  page.drawText(subtitle, {
    x: MARGIN,
    y: 762,
    size: 10,
    font,
    color: rgb(0.83, 0.89, 0.94),
  });
}

function splitText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) {
    return ["N/A"];
  }

  const words = cleanText.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color: RGB = BODY,
  lineHeight = size + 4,
) {
  const lines = splitText(text, font, size, maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color,
    });
  });

  return y - lines.length * lineHeight;
}

function drawSectionTitle(page: PDFPage, title: string, y: number, boldFont: PDFFont) {
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 13,
    font: boldFont,
    color: PRIMARY,
  });

  page.drawLine({
    start: { x: MARGIN, y: y - 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: y - 8 },
    thickness: 1,
    color: DIVIDER,
  });

  return y - 28;
}

function drawStatusIcon(page: PDFPage, status: ComplianceStatus, x: number, y: number) {
  const color = status === "verified" ? GREEN : status === "expired" || status === "missing" ? RED : AMBER;

  if (status === "verified") {
    page.drawCircle({ x: x + 6, y: y + 4, size: 6, color });
    page.drawLine({ start: { x: x + 2.5, y: y + 4 }, end: { x: x + 5.5, y: y + 1 }, thickness: 1.4, color: WHITE });
    page.drawLine({ start: { x: x + 5.5, y: y + 1 }, end: { x: x + 10.5, y: y + 8 }, thickness: 1.4, color: WHITE });
    return;
  }

  if (status === "expired" || status === "missing") {
    page.drawCircle({ x: x + 6, y: y + 4, size: 6, color });
    page.drawLine({ start: { x: x + 2.5, y: y }, end: { x: x + 9.5, y: y + 8 }, thickness: 1.2, color: WHITE });
    page.drawLine({ start: { x: x + 9.5, y: y }, end: { x: x + 2.5, y: y + 8 }, thickness: 1.2, color: WHITE });
    return;
  }

  page.drawRectangle({ x, y: y - 2, width: 13, height: 13, color, rotate: degrees(45) });
}

function drawWarningIcon(page: PDFPage, x: number, y: number, font: PDFFont) {
  page.drawRectangle({ x, y: y - 2, width: 13, height: 13, color: AMBER, rotate: degrees(45) });
  page.drawText("!", { x: x + 4.7, y: y, size: 8, font, color: WHITE });
}

function statusLabel(status: ComplianceStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "expired":
      return "Expired";
    case "warning":
      return "Requires review";
    case "missing":
    default:
      return "Missing";
  }
}

function drawMetricBox(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  accent: RGB,
  font: PDFFont,
  boldFont: PDFFont,
) {
  page.drawRectangle({ x, y: y - 62, width, height: 62, color: PANEL, borderColor: DIVIDER, borderWidth: 0.8 });
  page.drawRectangle({ x, y: y - 62, width: 4, height: 62, color: accent });
  page.drawText(label, { x: x + 14, y: y - 21, size: 8, font: boldFont, color: MUTED });
  drawWrappedText(page, value, x + 14, y - 42, width - 24, boldFont, 15, BODY, 16);
}

function drawKeyValueTable(
  page: PDFPage,
  rows: Array<[string, string]>,
  x: number,
  y: number,
  labelWidth: number,
  width: number,
  font: PDFFont,
  boldFont: PDFFont,
) {
  let cursorY = y;
  rows.forEach(([label, value], index) => {
    const rowHeight = 30;
    if (index % 2 === 0) {
      page.drawRectangle({ x, y: cursorY - rowHeight + 8, width, height: rowHeight, color: rgb(0.98, 0.99, 1) });
    }
    page.drawText(label, { x: x + 10, y: cursorY - 10, size: 9, font: boldFont, color: PRIMARY });
    drawWrappedText(page, value || "N/A", x + labelWidth, cursorY - 10, width - labelWidth - 12, font, 9, BODY, 11);
    cursorY -= rowHeight;
  });
  page.drawRectangle({ x, y: cursorY + 8, width, height: y - cursorY, borderColor: DIVIDER, borderWidth: 0.8 });
  return cursorY - 10;
}

function normalizeDocumentStatus(status: string | undefined, valid?: boolean): ComplianceStatus {
  if (valid === true || status === "verified" || status === "expiringSoon") {
    return "verified";
  }

  if (status === "expired") {
    return "expired";
  }

  if (status === "uploaded" || status === "invalid") {
    return "warning";
  }

  return "missing";
}

function getDocumentState(
  key: string,
  aliases: string[],
  compliance: ComplianceSummary | null,
  contractor: TenderContractorData,
) {
  const documents = compliance?.legacyDocuments ?? contractor.documents ?? null;
  if (documents) {
    for (const candidate of [key, ...aliases]) {
      const state = documents[candidate];
      if (state) {
        return {
          status: normalizeDocumentStatus(state.status, state.valid),
          detail: state.status ? titleCaseToken(state.status) : state.valid ? "Current document verified" : "Document not verified",
        };
      }
    }
  }

  const breakdown = compliance?.intelligence?.documentBreakdown ?? contractor.complianceDocumentBreakdown ?? null;
  const normalizedKeys = [key, ...aliases].map((item) => item.toLowerCase());
  const item = breakdown?.find((entry) => normalizedKeys.includes(asString(entry.documentType).toLowerCase()));
  if (item) {
    return {
      status: normalizeDocumentStatus(item.status, item.status === "verified" || item.status === "expiringSoon"),
      detail: asString(item.reason) || titleCaseToken(asString(item.status) || "verified"),
    };
  }

  const missingTypes = new Set([
    ...asStringArray(compliance?.missingDocumentTypes),
    ...asStringArray(contractor.missingDocumentTypes),
    ...asStringArray(contractor.missingCriticalDocuments),
  ].map((item) => item.toLowerCase()));
  if (normalizedKeys.some((candidate) => missingTypes.has(candidate))) {
    return { status: "missing" as ComplianceStatus, detail: "Required document is missing" };
  }

  return { status: "missing" as ComplianceStatus, detail: "No verification evidence found" };
}

function buildChecklist(compliance: ComplianceSummary | null, contractor: TenderContractorData): ComplianceChecklistItem[] {
  return CHECKLIST.map((item) => {
    const state = getDocumentState(item.key, item.aliases ?? [], compliance, contractor);
    return {
      key: item.key,
      label: item.label,
      status: state.status,
      detail: state.detail,
    };
  });
}

function drawComplianceTable(
  page: PDFPage,
  checklist: ComplianceChecklistItem[],
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  boldFont: PDFFont,
) {
  const headerHeight = 24;
  const rowHeight = 34;
  page.drawRectangle({ x, y: y - headerHeight, width, height: headerHeight, color: PRIMARY });
  page.drawText("Requirement", { x: x + 12, y: y - 16, size: 9, font: boldFont, color: WHITE });
  page.drawText("Status", { x: x + 170, y: y - 16, size: 9, font: boldFont, color: WHITE });
  page.drawText("Detail", { x: x + 285, y: y - 16, size: 9, font: boldFont, color: WHITE });

  let cursorY = y - headerHeight;
  checklist.forEach((item, index) => {
    const rowTop = cursorY;
    page.drawRectangle({
      x,
      y: rowTop - rowHeight,
      width,
      height: rowHeight,
      color: index % 2 === 0 ? rgb(0.98, 0.99, 1) : WHITE,
      borderColor: DIVIDER,
      borderWidth: 0.4,
    });
    page.drawText(item.label, { x: x + 12, y: rowTop - 21, size: 9, font: boldFont, color: BODY });
    if (item.status === "warning") {
      drawWarningIcon(page, x + 170, rowTop - 22, boldFont);
    } else {
      drawStatusIcon(page, item.status, x + 170, rowTop - 20);
    }
    page.drawText(statusLabel(item.status), {
      x: x + 190,
      y: rowTop - 21,
      size: 9,
      font: boldFont,
      color: item.status === "verified" ? GREEN : item.status === "warning" ? AMBER : RED,
    });
    drawWrappedText(page, item.detail, x + 285, rowTop - 16, width - 297, font, 8, MUTED, 10);
    cursorY -= rowHeight;
  });

  return cursorY - 12;
}

function drawBulletList(
  page: PDFPage,
  items: string[],
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  emptyText: string,
) {
  let cursorY = y;
  const list = items.length > 0 ? items : [emptyText];
  list.slice(0, 8).forEach((item) => {
    page.drawCircle({ x: x + 3, y: cursorY + 3, size: 2, color: ACCENT });
    cursorY = drawWrappedText(page, item, x + 12, cursorY, width - 12, font, 9, BODY, 12) - 4;
  });
  return cursorY;
}

function resolveCompliance(deal: TenderDealData, contractor: TenderContractorData): ComplianceSummary {
  const intelligence: ComplianceIntelligence = {
    ...(deal.intelligence ?? {}),
    ...(deal.compliance?.intelligence ?? {}),
    riskGrade:
      deal.compliance?.intelligence?.riskGrade ??
      deal.intelligence?.riskGrade ??
      contractor.riskGrade ??
      deal.riskGrade ??
      deal.riskLevel ??
      null,
    explainableSummary:
      deal.compliance?.intelligence?.explainableSummary ??
      deal.intelligence?.explainableSummary ??
      contractor.explainableSummary ??
      null,
    blockedReasons:
      deal.compliance?.intelligence?.blockedReasons ??
      deal.intelligence?.blockedReasons ??
      contractor.blockedReasons ??
      null,
    reviewRecommendations:
      deal.compliance?.intelligence?.reviewRecommendations ??
      deal.intelligence?.reviewRecommendations ??
      contractor.reviewRecommendations ??
      deal.suggestions ??
      null,
    documentBreakdown:
      deal.compliance?.intelligence?.documentBreakdown ??
      deal.intelligence?.documentBreakdown ??
      contractor.complianceDocumentBreakdown ??
      null,
  };

  return {
    ...(deal.compliance ?? {}),
    readinessScore:
      asFiniteNumber(deal.compliance?.readinessScore) ??
      asFiniteNumber(deal.readinessScore) ??
      asFiniteNumber(contractor.readinessScore),
    tenderLockStatus:
      deal.compliance?.tenderLockStatus ??
      deal.tenderLockStatus ??
      contractor.tenderLockStatus ??
      null,
    complianceApproved:
      typeof deal.compliance?.complianceApproved === "boolean"
        ? deal.compliance.complianceApproved
        : typeof deal.complianceApproved === "boolean"
          ? deal.complianceApproved
          : typeof contractor.complianceApproved === "boolean"
            ? contractor.complianceApproved
            : null,
    riskGrade: deal.compliance?.riskGrade ?? intelligence.riskGrade ?? null,
    docsMissing:
      asFiniteNumber(deal.compliance?.docsMissing) ??
      asFiniteNumber(contractor.docsMissing),
    missingDocumentTypes:
      deal.compliance?.missingDocumentTypes ??
      contractor.missingDocumentTypes ??
      deal.missingDocs ??
      deal.missingRequirements ??
      null,
    expiredDocumentCount: asFiniteNumber(deal.compliance?.expiredDocumentCount),
    legacyDocuments: deal.compliance?.legacyDocuments ?? contractor.documents ?? null,
    intelligence,
  };
}

function buildMissingRequirements(checklist: ComplianceChecklistItem[], compliance: ComplianceSummary): string[] {
  const checklistItems = checklist
    .filter((item) => item.status === "missing" || item.status === "expired")
    .map((item) => `${item.label}: ${statusLabel(item.status)}`);
  const blockerItems = asStringArray(compliance.intelligence?.blockedReasons);
  return Array.from(new Set([...checklistItems, ...blockerItems]));
}

function resolveSubmissionRecommendation(compliance: ComplianceSummary, missingRequirements: string[]) {
  if (compliance.tenderLockStatus === "READY" && compliance.complianceApproved === true && missingRequirements.length === 0) {
    return { label: "READY TO SUBMIT", color: GREEN };
  }

  if (compliance.tenderLockStatus === "BLOCKED" || missingRequirements.length > 0) {
    return { label: "BLOCKED", color: RED };
  }

  return { label: "REQUIRES ATTENTION", color: AMBER };
}

export async function generateTenderPdf(
  deal: TenderDealData,
  contractor: TenderContractorData,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await loadLogoBytes(contractor.logoBase64);
  const logoImage = logoBytes ? await pdfDoc.embedPng(logoBytes) : null;

  const coverPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const firstPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const secondPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const thirdPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const compliance = resolveCompliance(deal, contractor);
  const readinessScore = clampPercent(compliance.readinessScore);
  const checklist = buildChecklist(compliance, contractor);
  const missingRequirements = buildMissingRequirements(checklist, compliance);
  const recommendation = resolveSubmissionRecommendation(compliance, missingRequirements);
  const generatedAt = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
  const footerText = `Generated by Torque Empire AI Pro CRM - ${generatedAt}`;
  const riskGrade = asString(compliance.riskGrade) || "REVIEW";
  const tenderStatus = asString(compliance.tenderLockStatus) || asString(deal.status) || "PENDING";

  drawCoverPage({
    page: coverPage,
    deal,
    contractor,
    readinessScore,
    riskGrade,
    tenderStatus,
    generatedAt,
    recommendation,
    font,
    boldFont,
  });

  [coverPage, firstPage, secondPage, thirdPage].forEach((page, index) => {
    drawWatermark(page, boldFont);
    drawFooter(page, footerText, font, index + 1);
  });

  drawHeader(firstPage, "Contractor Tender Pack", deal.title || deal.id, font, boldFont);
  if (logoImage) {
    const scaled = logoImage.scale(0.18);
    const ratio = Math.min(1, 82 / scaled.width, 44 / scaled.height);
    firstPage.drawImage(logoImage, {
      x: PAGE_WIDTH - MARGIN - scaled.width * ratio,
      y: 778,
      width: scaled.width * ratio,
      height: scaled.height * ratio,
    });
  }

  firstPage.drawRectangle({ x: MARGIN, y: 666, width: CONTENT_WIDTH, height: 54, color: recommendation.color });
  firstPage.drawText("SUBMISSION RECOMMENDATION", {
    x: MARGIN + 18,
    y: 697,
    size: 8,
    font: boldFont,
    color: rgb(0.94, 0.98, 1),
  });
  firstPage.drawText(recommendation.label, {
    x: MARGIN + 18,
    y: 675,
    size: 20,
    font: boldFont,
    color: WHITE,
  });
  firstPage.drawText(`Readiness ${readinessScore}%`, {
    x: PAGE_WIDTH - MARGIN - 118,
    y: 678,
    size: 16,
    font: boldFont,
    color: WHITE,
  });

  const metricWidth = (CONTENT_WIDTH - 24) / 4;
  drawMetricBox(firstPage, MARGIN, 632, metricWidth, "READINESS SCORE", `${readinessScore}%`, ACCENT, font, boldFont);
  drawMetricBox(firstPage, MARGIN + metricWidth + 8, 632, metricWidth, "LOCK STATUS", asString(compliance.tenderLockStatus) || "PENDING", recommendation.color, font, boldFont);
  drawMetricBox(firstPage, MARGIN + (metricWidth + 8) * 2, 632, metricWidth, "COMPLIANCE", compliance.complianceApproved === true ? "APPROVED" : "NOT APPROVED", compliance.complianceApproved === true ? GREEN : AMBER, font, boldFont);
  drawMetricBox(firstPage, MARGIN + (metricWidth + 8) * 3, 632, metricWidth, "RISK GRADE", riskGrade, compliance.riskGrade === "LOW RISK" ? GREEN : AMBER, font, boldFont);
  drawReadinessGauge(firstPage, readinessScore, MARGIN, 528, CONTENT_WIDTH - 72, font, boldFont);

  let y = drawSectionTitle(firstPage, "Contractor Details", 464, boldFont);
  y = drawKeyValueTable(
    firstPage,
    [
      ["Company Name", contractor.companyName || contractor.name || "N/A"],
      ["Registration Number", contractor.registrationNumber ?? contractor.companyRegistrationNumber ?? "N/A"],
      ["CSD Number", contractor.csdNumber ?? "N/A"],
      ["Contact Person", contractor.contactPerson ?? contractor.contactName ?? contractor.directorName ?? "N/A"],
      ["Email", contractor.email ?? contractor.contactEmail ?? "N/A"],
      ["Telephone", contractor.telephone ?? contractor.phone ?? contractor.contactPhone ?? "N/A"],
    ],
    MARGIN,
    y,
    155,
    CONTENT_WIDTH,
    font,
    boldFont,
  );

  y = drawSectionTitle(firstPage, "Tender Details", y - 4, boldFont);
  drawKeyValueTable(
    firstPage,
    [
      ["Deal ID", deal.id],
      ["Tender Title", deal.title || "N/A"],
      ["Tender Status", deal.status ?? "N/A"],
      ["Contract Value", formatCurrency(deal.value)],
    ],
    MARGIN,
    y,
    155,
    CONTENT_WIDTH,
    font,
    boldFont,
  );

  drawHeader(secondPage, "Compliance Summary", "Document verification and readiness controls", font, boldFont);
  let secondY = drawSectionTitle(secondPage, "Compliance Checklist", 706, boldFont);
  secondY = drawComplianceTable(secondPage, checklist, MARGIN, secondY + 8, CONTENT_WIDTH, font, boldFont);

  secondY = drawSectionTitle(secondPage, "Missing or Expired Requirements", secondY - 6, boldFont);
  secondY = drawBulletList(
    secondPage,
    missingRequirements,
    MARGIN + 4,
    secondY,
    CONTENT_WIDTH - 8,
    font,
    "No missing or expired requirements detected.",
  );

  secondY = drawSectionTitle(secondPage, "Readiness Notes", secondY - 8, boldFont);
  drawWrappedText(
    secondPage,
    `Compliance approved: ${compliance.complianceApproved === true ? "Yes" : "No"} | Documents missing: ${compliance.docsMissing ?? missingRequirements.length} | Expired documents: ${compliance.expiredDocumentCount ?? 0}`,
    MARGIN,
    secondY,
    CONTENT_WIDTH,
    font,
    10,
    BODY,
    14,
  );

  drawHeader(thirdPage, "AI Intelligence", "Readiness assessment, findings, and recommended actions", font, boldFont);
  let thirdY = drawSectionTitle(thirdPage, "Overall Readiness Assessment", 706, boldFont);
  thirdY = drawWrappedText(
    thirdPage,
    asString(compliance.intelligence?.explainableSummary) ||
      (recommendation.label === "READY TO SUBMIT"
        ? "Ready because all required compliance documents are verified and current."
        : "Review required because one or more compliance requirements are missing, expired, or unverified."),
    MARGIN,
    thirdY,
    CONTENT_WIDTH,
    font,
    10,
    BODY,
    14,
  ) - 10;

  thirdY = drawSectionTitle(thirdPage, "Compliance Findings", thirdY, boldFont);
  thirdY = drawBulletList(
    thirdPage,
    checklist
      .filter((item) => item.status !== "verified")
      .map((item) => `${item.label}: ${item.detail}`),
    MARGIN + 4,
    thirdY,
    CONTENT_WIDTH - 8,
    font,
    "No compliance exceptions were identified.",
  ) - 8;

  thirdY = drawSectionTitle(thirdPage, "Risk Findings", thirdY, boldFont);
  thirdY = drawBulletList(
    thirdPage,
    asStringArray(compliance.intelligence?.blockedReasons),
    MARGIN + 4,
    thirdY,
    CONTENT_WIDTH - 8,
    font,
    asString(compliance.riskGrade) || "No risk findings were supplied.",
  ) - 8;

  thirdY = drawSectionTitle(thirdPage, "Recommended Actions", thirdY, boldFont);
  drawBulletList(
    thirdPage,
    asStringArray(compliance.intelligence?.reviewRecommendations),
    MARGIN + 4,
    thirdY,
    CONTENT_WIDTH - 8,
    font,
    recommendation.label === "READY TO SUBMIT"
      ? "Maintain current compliance documents through submission."
      : "Upload or renew the listed compliance documents before submission.",
  );

  return pdfDoc.save();
}
