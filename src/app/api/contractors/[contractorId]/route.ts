import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";

export async function GET(
  request: Request,
  { params }: { params: { contractorId: string } }
) {
  try {
    const contractorId = params.contractorId;

    if (!contractorId) {
      return NextResponse.json(
        { error: "Missing contractorId" },
        { status: 400 }
      );
    }

    const { db } = getFirebaseAdmin();

    const docSnap = await db
      .collection("contractors")
      .doc(contractorId)
      .get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "Contractor not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data() ?? {};

    return NextResponse.json(
      {
        id: docSnap.id,
        companyName:
          typeof data.companyName === "string"
            ? data.companyName
            : "",
        email:
          typeof data.email === "string"
            ? data.email
            : "",
        status:
          typeof data.status === "string"
            ? data.status
            : "",
        createdAt:
          typeof data.createdAt === "number"
            ? data.createdAt
            : 0,
      },
      { status: 200 }
    );
  } catch (error) {
    GuardianMonitor.error("api.contractors.detail.GET", "Contractor detail error", {
      contractorId: params?.contractorId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { value: String(error) },
    });

    console.error("Contractor detail error:", error);

    return NextResponse.json(
      { error: "Failed to load contractor" },
      { status: 500 }
    );
  }
}
