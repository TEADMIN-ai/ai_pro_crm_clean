import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { createContractor, listContractors } from "@/server/services/contractorService";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const contractors = await listContractors();

    return NextResponse.json({ contractors }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("GET /api/contractors error:", error);
    return NextResponse.json({ error: "Failed to fetch contractors" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const body = (await request.json()) as Record<string, unknown>;
    const companyName = getString(body.companyName);
    const companyRegistrationNumber = getString(body.companyRegistrationNumber);
    const email = getString(body.email);
    const phone = getString(body.phone);
    const status = getString(body.status) || "pending";

    if (!companyName || !companyRegistrationNumber || !email || !phone) {
      return NextResponse.json(
        { error: "companyName, companyRegistrationNumber, email, and phone are required" },
        { status: 400 },
      );
    }

    const contractorId = await createContractor(
      {
        companyName,
        companyRegistrationNumber,
        email,
        phone,
        status,
        readinessScore: 0,
        docsMissing: 0,
        tenderLockStatus: "BLOCKED",
        isTenderLocked: true,
      },
      user,
    );

    return NextResponse.json({ success: true, contractorId }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/contractors error:", error);
    return NextResponse.json({ error: "Failed to create contractor" }, { status: 500 });
  }
}
