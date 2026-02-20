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
      normalizeContractor(doc.id, doc.data())
    );

    return NextResponse.json({ contractors }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch contractors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
