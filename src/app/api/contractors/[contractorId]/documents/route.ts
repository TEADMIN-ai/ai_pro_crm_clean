import { NextRequest, NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { initFirebaseAdmin } from "@/lib/firebase/admin";
import { canUploadContractorDocs, type UserRole } from "@/lib/auth/roleUtils";
import type { ContractorDocument } from "@/types/document";
import { getFirestore } from "firebase-admin/firestore";
import { extractDocumentData, extractExpiryFromDocumentText } from "@/lib/ai/extractDocumentData";
import { classifyDocument } from "@/lib/ai/classifyDocument";

type RouteContext = {
  params: Promise<{ contractorId: string }>;
};

type AuthContext = {
  uid: string;
  role: UserRole;
  contractorId: string | null;
};

function normalizeUserRole(role: unknown): UserRole {
  if (
    role === "admin" ||
    role === "manager" ||
    role === "staff" ||
    role === "contractor"
  ) {
    return role;
  }
  return "guest";
}

async function authenticate(req: NextRequest): Promise<AuthContext | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const idToken = authHeader.split("Bearer ")[1];
  initFirebaseAdmin();

  let decodedToken: DecodedIdToken;
  try {
    const adminAuth = getAuth();
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(decodedToken.uid).get();

  if (!userDoc.exists) {
    return NextResponse.json({ error: "User document not found" }, { status: 404 });
  }

  const userData = userDoc.data() as { role?: unknown; contractorId?: unknown };
  const role = normalizeUserRole(userData.role ?? decodedToken.role);
  const contractorId =
    typeof userData.contractorId === "string" ? userData.contractorId : null;

  return {
    uid: decodedToken.uid,
    role,
    contractorId,
  };
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    // 1) Authenticate Firebase user.
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    // 2) Verify role permissions.
    if (!canUploadContractorDocs(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { contractorId } = await context.params;
    if (!contractorId) {
      return NextResponse.json({ error: "Missing contractorId" }, { status: 400 });
    }

    if (auth.role === "contractor" && auth.contractorId !== contractorId) {
      return NextResponse.json(
        { error: "Contractor can only upload documents for own contractor profile" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const storagePath = typeof body?.storagePath === "string" ? body.storagePath.trim() : "";
    const downloadURL = typeof body?.downloadURL === "string" ? body.downloadURL.trim() : "";

    if (!name || !storagePath || !downloadURL) {
      return NextResponse.json(
        { error: "Missing required fields: name, storagePath, downloadURL" },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const documentsRef = db.collection("contractors").doc(contractorId).collection("documents");
    const docRef = documentsRef.doc();

    // 3) Save metadata document first, before any AI processing.
    const document: ContractorDocument = {
      id: docRef.id,
      contractorId,
      name,
      storagePath,
      downloadURL,
      uploadedBy: auth.uid,
      uploadedAt: Date.now(),
      status: "active",
      expiresAt: null,
      docType: null,
    };

    await docRef.set(document);

    let docType: string | null = null;
    let expiresAt: number | null = null;

    try {
      // 4) Extract text/mime from stored document.
      const extracted = await extractDocumentData({ storagePath, filename: name });
      // 5) Classify document type from text with filename fallback.
      const classification = await classifyDocument({
        text: extracted.text,
        fileName: name,
      });
      // 6) Extract expiry from document text.
      expiresAt = await extractExpiryFromDocumentText({
        text: extracted.text,
        fileName: name,
        docType: classification.docType,
      });
      docType = classification.docType;
    } catch (aiError) {
      console.error("AI document processing failed", {
        contractorId,
        documentId: docRef.id,
        storagePath,
        aiError,
      });
    }

    // 7) Update Firestore with docType/expiresAt/status.
    const aiUpdate: Pick<ContractorDocument, "docType" | "expiresAt" | "status"> = {
      docType,
      expiresAt,
      status: typeof expiresAt === "number" && expiresAt < Date.now() ? "expired" : "active",
    };

    await docRef.update(aiUpdate);

    const finalSnapshot = await docRef.get();
    const finalDocument = finalSnapshot.data() as ContractorDocument | undefined;
    if (!finalDocument) {
      throw new Error("Document write failed");
    }

    return NextResponse.json({ success: true, document: finalDocument }, { status: 201 });
  } catch (error) {
    console.error("Contractor document upload failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    if (!canUploadContractorDocs(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { contractorId } = await context.params;
    if (!contractorId) {
      return NextResponse.json({ error: "Missing contractorId" }, { status: 400 });
    }

    if (auth.role === "contractor" && auth.contractorId !== contractorId) {
      return NextResponse.json(
        { error: "Contractor can only access documents for own contractor profile" },
        { status: 403 }
      );
    }

    const db = getFirestore();
    const snapshot = await db
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .orderBy("uploadedAt", "desc")
      .get();

    const documents = snapshot.docs.map((doc) => doc.data() as ContractorDocument);
    return NextResponse.json({ documents }, { status: 200 });
  } catch (error) {
    console.error("Contractor document fetch failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
