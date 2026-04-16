import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { db } from "@/lib/firebaseAdmin";
import { listContractors } from "@/server/services/contractorService";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// GET - Fetch contractors
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const contractors = await listContractors();
    return NextResponse.json(contractors);
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(" CONTRACTORS FETCH ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch contractors", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create contractor
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);
    assertPrivilegedRole(user);

    const body = (await req.json()) as Record<string, unknown>;
    const email = getString(body.email);
    const companyName = getString(body.companyName) || getString(body.company) || getString(body.name);
    const registrationNumber =
      getString(body.registrationNumber) || getString(body.companyRegistrationNumber);

    if (!email || !companyName) {
      return NextResponse.json(
        { error: "Missing required contractor fields" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    const userRecord = await getAuth().createUser({
      email,
      password: "Temp123!",
    });

    const contractorId = userRecord.uid;
    const createdAt = new Date().toISOString();

    await db.collection("contractors").doc(contractorId).set({
      id: contractorId,
      contractorId,
      authUid: contractorId,
      userId: contractorId,
      email,
      companyName,
      company: companyName,
      name: companyName,
      registrationNumber: registrationNumber || "",
      companyRegistrationNumber: registrationNumber || "",
      createdAt,
      updatedAt: createdAt,
    });

    return NextResponse.json({ success: true, contractorId }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("CREATE CONTRACTOR ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create contractor" },
      { status: 500 }
    );
  }
}
