export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { getIntelligenceCenterOverview } from "@/server/services/intelligenceCenterService";
import type { IntelligenceCenterOverview } from "@/types/intelligenceCenter";

type ReportFormat = "csv" | "excel" | "pdf";
type ReportPeriod = "daily" | "weekly" | "monthly";

function safeFormat(value: string | null): ReportFormat {
  return value === "excel" || value === "pdf" || value === "csv" ? value : "csv";
}

function safePeriod(value: string | null): ReportPeriod {
  return value === "weekly" || value === "monthly" || value === "daily" ? value : "daily";
}

function csvCell(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildRows(overview: IntelligenceCenterOverview, period: ReportPeriod): string[][] {
  const generatedAt = new Date().toISOString();
  const metricRows = Object.entries(overview.metrics).map(([key, value]) => [
    "metric",
    period,
    key,
    String(value),
    generatedAt,
  ]);
  const alertRows = overview.complianceAlerts.map((alert) => [
    "complianceAlert",
    period,
    alert.documentType,
    `${alert.contractorName} ${alert.severity} ${alert.expiresAt}`,
    generatedAt,
  ]);
  const decisionRows = overview.decisionLogs.slice(0, 50).map((decision) => [
    "decision",
    period,
    decision.triggerEvent ?? "readiness",
    decision.reasonForChange ?? "",
    decision.timestamp,
  ]);

  return [["section", "period", "name", "value", "timestamp"], ...metricRows, ...alertRows, ...decisionRows];
}

function buildCsv(overview: IntelligenceCenterOverview, period: ReportPeriod): string {
  return buildRows(overview, period).map((row) => row.map(csvCell).join(",")).join("\n");
}

function xmlCell(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildExcelXml(overview: IntelligenceCenterOverview, period: ReportPeriod): string {
  const rows = buildRows(overview, period)
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlCell(cell)}</Data></Cell>`).join("")}</Row>`,
    )
    .join("");

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Intelligence Report">
  <Table>${rows}</Table>
 </Worksheet>
</Workbook>`;
}

function buildPdf(overview: IntelligenceCenterOverview, period: ReportPeriod): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const metrics = overview.metrics;
  const lines = [
    `Torque Empire Intelligence Report`,
    `Period: ${period}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    `Total Contractors: ${metrics.totalContractors}`,
    `New Contractors: ${metrics.newContractors}`,
    `Ready Contractors: ${metrics.readyContractors}`,
    `Risk Contractors: ${metrics.riskContractors}`,
    `Blocked Contractors: ${metrics.blockedContractors}`,
    `Documents Uploaded Today: ${metrics.documentsUploadedToday}`,
    `AI Analyses Today: ${metrics.aiAnalysesToday}`,
    `Tender Packs Generated: ${metrics.tenderPacksGenerated}`,
    `User Activity Today: ${metrics.userActivityToday}`,
    "",
    "Compliance Alerts",
    ...overview.complianceAlerts
      .slice(0, 20)
      .map((alert) => `${alert.contractorName} | ${alert.documentType} | ${alert.severity} | ${alert.expiresAt}`),
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(lines[0], 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  let y = 82;
  for (const line of lines.slice(1)) {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    doc.text(line || " ", 40, y);
    y += 16;
  }

  return doc.output("arraybuffer");
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);

    const { searchParams } = new URL(request.url);
    const format = safeFormat(searchParams.get("format"));
    const period = safePeriod(searchParams.get("period"));
    const overview = await getIntelligenceCenterOverview();
    const filename = `intelligence-${period}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "pdf") {
      return new NextResponse(buildPdf(overview, period), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    if (format === "excel") {
      return new NextResponse(buildExcelXml(overview, period), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="${filename}.xls"`,
        },
      });
    }

    return new NextResponse(buildCsv(overview, period), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[intelligence-center] report export failed", error);
    return NextResponse.json({ error: "Intelligence report unavailable" }, { status: 500 });
  }
}
