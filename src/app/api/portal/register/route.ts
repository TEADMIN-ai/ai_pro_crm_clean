import { NextResponse } from "next/server";
import { getAdmin } from "@/server/firebase-admin";

export const runtime = "nodejs";

type RegisterBody = {
  companyName?: string;
  email?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function methodNotAllowed() {
  return jsonError("Method not allowed", 405);
}

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    let payload: RegisterBody;

    try {
      payload = (await request.json()) as RegisterBody;
    } catch {
      return jsonError("Invalid JSON payload", 400);
    }

    const companyName = getTrimmedString(payload.companyName);
    const email = getTrimmedString(payload.email);

    if (!companyName) {
      return jsonError("companyName is required", 400);
    }

    if (!email) {
      return jsonError("email is required", 400);
    }

    const { db } = getAdmin();
    const docRef = await db.collection("contractors").add({
      companyName,
      email,
      status: "pending",
      createdAt: Date.now(),
      compliancePercentage: 0,
    });

    return NextResponse.json({ success: true, contractorId: docRef.id }, { status: 200 });
  } catch (error) {
    console.error("Portal registration failed:", error);
    return jsonError("Registration failed", 500);
  }
}

export async function GET() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function OPTIONS() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    {
      status: 405,
      headers: { Allow: "POST" },
    }
  );
}
