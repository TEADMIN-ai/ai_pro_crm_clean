import { NextRequest } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "system";

    // BULLETPROOF PARAM EXTRACTION
    const url = new URL(request.url);
    const documentId = url.pathname.split("/")[3];

    console.log("Incoming documentId:", documentId);

    if (!documentId || typeof documentId !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid documentId" }),
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();

    const docRef = db.collection("documents").doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404 }
      );
    }

    const existing = docSnap.data();
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return new Response(
        JSON.stringify({ error: "Missing status" }),
        { status: 400 }
      );
    }

    await docRef.update({
      status,
      updatedAt: new Date().toISOString(),

      // LAST ACTION (for UI display)
      lastActionBy: userId,
      lastActionAt: new Date().toISOString(),
      lastActionType: status,

      // FULL AUDIT TRAIL (append only)
      auditTrail: [
        ...(existing?.auditTrail || []),
        {
          action: status,
          by: userId,
          at: new Date().toISOString(),
        },
      ],
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Status update failed:", error);

    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}
