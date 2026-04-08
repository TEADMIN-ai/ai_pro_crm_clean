import { NextRequest, NextResponse } from "next/server";
import { createContractor, getContractorById, listContractors } from "@/server/services/contractorService";
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
    const name = getString(body.name);
    const email = getString(body.email);
    const phone = getString(body.phone);
    const company = getString(body.company);

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    const contractorId = await createContractor({
      name,
      email,
      phone,
      company,
      companyName: company || name,
      contactEmail: email,
      contactPhone: phone,
      createdAt: Date.now(),
    });

    const createdContractor = await getContractorById(contractorId);

    if (!createdContractor) {
      return NextResponse.json(
        { error: "Failed to load created contractor" },
        { status: 500 }
      );
    }

    return NextResponse.json(createdContractor, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(" CONTRACTOR CREATE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create contractor", details: error.message },
      { status: 500 }
    );
  }
}
