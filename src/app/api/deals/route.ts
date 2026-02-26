import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";

type DealStatus = "draft" | "submitted" | "awarded";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeStatus(value: unknown): DealStatus {
  if (value === "submitted" || value === "awarded") {
    return value;
  }
  return "draft";
}

export async function GET() {
  try {
    const db = getFirebaseAdmin();
    const snapshot = await db
      .collection("deals")
      .orderBy("createdAt", "desc")
      .get();

    const deals = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const contractorName = getString(data.contractorName);
      const contractorId = getString(data.contractorId) || getString(data.companyId);
      const createdAtRaw = data.createdAt;
      const createdAt =
        createdAtRaw instanceof Date
          ? createdAtRaw.getTime()
          : getNumber(createdAtRaw);

      return {
        id: doc.id,
        title: getString(data.title) || "Untitled deal",
        contractorId,
        contractorName: contractorName || contractorId || "Unknown contractor",
        value: getNumber(data.value),
        status: normalizeStatus(data.status ?? data.stage),
        createdAt: createdAt || Date.now(),
      };
    });

    return NextResponse.json({ deals }, { status: 200 });
  } catch (error) {
    GuardianMonitor.error("api.deals.GET", "Failed to fetch deals", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { value: String(error) },
    });
    console.error("Failed to fetch deals:", error);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getFirebaseAdmin();
    const body = (await request.json()) as Record<string, unknown>;

    const title = getString(body.title);
    const contractorId = getString(body.contractorId);
    const contractorName = getString(body.contractorName);
    const value = getNumber(body.value);
    const status = normalizeStatus(body.status);
    const createdAt = Date.now();

    if (!title || !contractorId) {
      return NextResponse.json(
        { error: "title and contractorId are required" },
        { status: 400 }
      );
    }

    const doc = {
      title,
      contractorId,
      contractorName: contractorName || contractorId,
      value,
      status,
      createdAt,
    };

    const docRef = await db.collection("deals").add(doc);

    return NextResponse.json(
      { deal: { id: docRef.id, ...doc } },
      { status: 201 }
    );
  } catch (error) {
    GuardianMonitor.error("api.deals.POST", "Failed to create deal", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { value: String(error) },
    });
    console.error("Failed to create deal:", error);
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}
