import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import type { Contractor } from "@/types/contractor";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { safeFirestoreQuery } from "@/lib/server/safeFirestore";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["admin", "manager", "staff"]);

function hasKey<K extends string>(value: object, key: K): value is Record<K, unknown> {
  return key in value;
}

function getString(data: unknown, key: string): string | null {
  if (typeof data !== "object" || data === null || !hasKey(data, key)) {
    return null;
  }

  const value = data[key];
  return typeof value === "string" ? value : null;
}

function getNumber(data: unknown, key: string): number | null {
  if (typeof data !== "object" || data === null || !hasKey(data, key)) {
    return null;
  }

  const value = data[key];
  return typeof value === "number" ? value : null;
}

function normalizeContractor(id: string, data: unknown): Contractor {
  return {
    id,
    name: getString(data, "name"),
    companyName: getString(data, "companyName"),
    contactPerson: getString(data, "contactPerson"),
    email: getString(data, "email"),
    phone: getString(data, "phone"),
    status: getString(data, "status"),
    createdAt: getNumber(data, "createdAt"),
    createdBy: getString(data, "createdBy"),
  };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const idToken = authHeader.slice("Bearer ".length).trim();
    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(idToken);
    const role = typeof decodedToken.role === "string" ? decodedToken.role : "";

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getFirebaseAdmin();
    const snapshot = await safeFirestoreQuery(() =>
      db.collection("contractors").orderBy("createdAt", "desc").get()
    );

    const contractors: Contractor[] = snapshot.docs.map((doc) =>
      normalizeContractor(doc.id, doc.data())
    );

    return NextResponse.json({ contractors }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch contractors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
