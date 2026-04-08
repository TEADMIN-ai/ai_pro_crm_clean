import { NextRequest, NextResponse } from "next/server";
import { createLeadDeal } from "@/server/services/dealService";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const titlePrefix = typeof body.vehicle === "string" && body.vehicle.trim() ? body.vehicle.trim() : "Vehicle";
    const lead = await createLeadDeal({
      title: `${titlePrefix} enquiry`,
      source: "car_sales_bot",
      companyId: typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : "default",
      customerName: typeof body.customerName === "string" ? body.customerName : "",
      contactMethod: typeof body.contactMethod === "string" ? body.contactMethod : "",
      vehicle: typeof body.vehicle === "string" ? body.vehicle : "",
      budget: typeof body.budget === "string" ? body.budget : "",
      financeRequired: typeof body.financeRequired === "string" ? body.financeRequired : "",
      purchaseTimeline: typeof body.purchaseTimeline === "string" ? body.purchaseTimeline : "",
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create lead:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
