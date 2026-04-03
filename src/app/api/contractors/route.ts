import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { createContractor } from "@/server/services/contractorService";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - missing token" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const role = userData?.role;
    const contractorId = userData?.contractorId;

    if (role === "staff" || role === "admin") {
      const snapshot = await adminDb.collection("contractors").get();

      const contractors = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return NextResponse.json({ contractors });
    }

    if (!contractorId) {
      return NextResponse.json(
        { error: "No contractor linked to user" },
        { status: 403 }
      );
    }

    const contractorDoc = await adminDb
      .collection("contractors")
      .doc(contractorId)
      .get();

    if (!contractorDoc.exists) {
      return NextResponse.json({ contractors: [] });
    }

    return NextResponse.json({
      contractors: [
        {
          id: contractorDoc.id,
          ...contractorDoc.data(),
        },
      ],
    });
  } catch (error) {
    console.error("CONTRACTORS API ERROR:", error);

    return NextResponse.json(
      { error: "Unauthorized or invalid token" },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const body = (await request.json()) as Record<string, unknown>;
    const companyName = getString(body.companyName);
    const companyRegistrationNumber = getString(body.companyRegistrationNumber);
    const email = getString(body.email);
    const phone = getString(body.phone);
    const status = getString(body.status) || "pending";

    if (!companyName || !companyRegistrationNumber || !email || !phone) {
      return NextResponse.json(
        { error: "companyName, companyRegistrationNumber, email, and phone are required" },
        { status: 400 },
      );
    }

    const contractorId = await createContractor(
      {
        companyName,
        companyRegistrationNumber,
        email,
        phone,
        status,
        readinessScore: 0,
        docsMissing: 0,
        tenderLockStatus: "BLOCKED",
        isTenderLocked: true,
      },
      user,
    );

    return NextResponse.json({ success: true, contractorId }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/contractors error:", error);
    return NextResponse.json({ error: "Failed to create contractor" }, { status: 500 });
  }
}
