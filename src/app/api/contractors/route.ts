import { NextRequest, NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import type { Contractor } from "@/types/contractor";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["admin", "manager", "staff"]);

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function loadServiceAccount(): ServiceAccount {
  const serviceAccountPath = path.join(process.cwd(), "secrets", "service-account.json");
  const raw = fs.readFileSync(serviceAccountPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;

  if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
    throw new Error("Invalid Firebase service account JSON.");
  }

  return {
    projectId: parsed.projectId,
    clientEmail: parsed.clientEmail,
    privateKey: parsed.privateKey,
  };
}

function initAdmin(): void {
  if (getApps().length > 0) return;

  const serviceAccount = loadServiceAccount();
  initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });
}

function normalizeCreatedAt(value: unknown): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return ((value as { toMillis: () => number }).toMillis)();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }

  return 0;
}

function toContractor(id: string, data: Record<string, unknown>): Contractor {
  return {
    id,
    companyName: typeof data.companyName === "string" ? data.companyName : "",
    contactPerson: typeof data.contactPerson === "string" ? data.contactPerson : "",
    email: typeof data.email === "string" ? data.email : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    status:
      data.status === "active" || data.status === "pending" || data.status === "suspended"
        ? data.status
        : "pending",
    createdAt: normalizeCreatedAt(data.createdAt),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
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

    initAdmin();

    const decodedToken = await getAuth().verifyIdToken(idToken);
    const role = typeof decodedToken.role === "string" ? decodedToken.role : "";

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await getFirestore()
      .collection("contractors")
      .orderBy("createdAt", "desc")
      .get();

    const contractors: Contractor[] = snapshot.docs.map((doc) =>
      toContractor(doc.id, doc.data() as Record<string, unknown>)
    );

    return NextResponse.json({ contractors }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch contractors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
