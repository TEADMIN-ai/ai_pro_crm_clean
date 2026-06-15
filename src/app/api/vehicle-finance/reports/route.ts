export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { buildVehicleFinanceCsv, buildVehicleFinanceExcel, buildVehicleFinancePdf } from "@/lib/vehicleFinance/vehicleFinanceService";

type ReportFormat = "csv" | "excel" | "pdf";
type ReportPeriod = "daily" | "weekly" | "monthly";

function safeFormat(value: string | null): ReportFormat {
  return value === "excel" || value === "pdf" || value === "csv" ? value : "csv";
}

function safePeriod(value: string | null): ReportPeriod {
  return value === "weekly" || value === "monthly" || value === "daily" ? value : "daily";
}

function reportFilename(period: ReportPeriod, extension: string) {
  return `vehicle-finance-${period}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { searchParams } = new URL(request.url);
    const format = safeFormat(searchParams.get("format"));
    const period = safePeriod(searchParams.get("period"));

    if (format === "pdf") {
      const pdf = await buildVehicleFinancePdf();
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${reportFilename(period, "pdf")}"`,
        },
      });
    }

    if (format === "excel") {
      const excel = await buildVehicleFinanceExcel();
      return new NextResponse(excel, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="${reportFilename(period, "xls")}"`,
        },
      });
    }

    const csv = await buildVehicleFinanceCsv();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFilename(period, "csv")}"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] report export failed", error);
    return NextResponse.json({ error: "Vehicle finance report unavailable" }, { status: 500 });
  }
}
