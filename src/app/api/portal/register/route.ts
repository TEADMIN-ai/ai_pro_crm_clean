import { NextRequest, NextResponse } from "next/server";
import { createContractor } from "@/server/services/contractorService";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 403 });
    }

    const body = await req.json();

    const contractor = {
      companyName: body.companyName,
      email: body.email,
      status: "pending",
      createdAt: Date.now(),
      compliancePercentage: 0
    };

    const contractorId = await createContractor(contractor);

    return NextResponse.json({
      success: true,
      contractorId
    });

  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json({
      success: false,
      error: "Registration failed"
    }, { status: 500 });
  }
}
