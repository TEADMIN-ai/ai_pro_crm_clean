import { NextResponse } from "next/server";
import { createContractor } from "@/server/services/contractorService";

export async function POST(req: Request) {
  try {
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
    return NextResponse.json({
      success: false,
      error: "Registration failed"
    }, { status: 500 });
  }
}
