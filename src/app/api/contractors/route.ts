import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { ensureContractorAuthLinkage } from "@/lib/contractors/contractorAuthLink";
import { listContractors } from "@/server/services/contractorService";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown): string | null {
  const normalized = getString(value);
  return normalized.length > 0 ? normalized : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: unknown): string {
  return getString(value).toLowerCase();
}

function isFirebaseAuthError(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code === code
  );
}

async function findExistingContractorByEmail(email: string) {
  const db = getFirebaseAdmin();
  const normalizedEmail = normalizeEmail(email);
  const fields = ["email", "contactEmail"] as const;

  for (const field of fields) {
    const snapshot = await db.collection("contractors").where(field, "==", normalizedEmail).limit(1).get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...(doc.data() ?? {}),
      } as Record<string, unknown> & { id: string };
    }
  }

  return null;
}

async function repairExistingContractorByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  try {
    const authUser = await getAuth().getUserByEmail(normalizedEmail);
    return await ensureContractorAuthLinkage({
      uid: authUser.uid,
      source: "api.contractors.repairExistingContractorByEmail",
      authUser,
      decodedEmail: normalizedEmail,
      allowCreateMissingContractor: true,
    });
  } catch (error) {
    if (isFirebaseAuthError(error, "auth/user-not-found")) {
      return null;
    }

    console.error("[contractor-linkage] email_conflict_repair_failed", {
      email: normalizedEmail,
      error,
    });
    return null;
  }
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
  let submittedEmail = "";

  try {
    const user = await requireAuthorizedUser(req);
    assertPrivilegedRole(user);

    const body = (await req.json()) as Record<string, unknown>;
    const auth = getAuth();
    const db = getFirebaseAdmin();
    const email = normalizeEmail(body.email);
    submittedEmail = email;
    const companyName = getString(body.companyName) || getString(body.company) || getString(body.name);
    const contactPerson = getString(body.contactPerson) || companyName;
    const phone = getOptionalString(body.phone) ?? getOptionalString(body.contactPhone);
    const registrationNumber =
      getString(body.registrationNumber) || getString(body.companyRegistrationNumber);

    if (!email || !companyName) {
      return NextResponse.json(
        { error: "Missing required contractor fields" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    const userRecord = await auth.createUser({
      displayName: contactPerson,
      email,
    });
    const passwordResetLink = await auth.generatePasswordResetLink(email);

    const contractorId = userRecord.uid;
    const createdAt = Date.now();
    const updatedAt = new Date(createdAt).toISOString();
    const contractorRecord = {
      ...(body as Record<string, unknown>),
      id: contractorId,
      uid: contractorId,
      contractorId,
      authUid: contractorId,
      userId: contractorId,
      email,
      contactEmail: email,
      companyName,
      company: companyName,
      name: companyName,
      contactPerson,
      phone,
      contactPhone: phone,
      registrationNumber: registrationNumber || "",
      companyRegistrationNumber: registrationNumber || "",
      createdAt,
      updatedAt,
      complianceApproved: false,
      createdBy: user.uid,
      createdByEmail: user.email ?? null,
    };

    try {
      await Promise.all([
        db.collection("contractors").doc(contractorId).set(contractorRecord),
        db.collection("users").doc(contractorId).set({
          uid: contractorId,
          name: contactPerson,
          email,
          role: "contractor",
          contractorId,
          createdAt,
        }),
        auth.setCustomUserClaims(contractorId, {
          role: "contractor",
          contractorId,
        }),
      ]);

      await ensureContractorAuthLinkage({
        uid: contractorId,
        source: "api.contractors.POST",
        authUser: userRecord,
        decodedRole: "contractor",
        decodedContractorId: contractorId,
        decodedEmail: email,
        profile: {
          name: contactPerson,
          email,
          role: "contractor",
          contractorId,
          createdAt,
        },
        allowCreateMissingContractor: true,
      });
    } catch (writeError) {
      await auth.deleteUser(contractorId).catch((cleanupError) => {
        console.error("Failed to rollback contractor auth user after creation error:", cleanupError);
      });

      throw writeError;
    }

    return NextResponse.json(
      {
        success: true,
        contractorId,
        uid: contractorId,
        contractor: contractorRecord,
        passwordResetLink,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isFirebaseAuthError(error, "auth/email-already-exists")) {
      const repaired = submittedEmail ? await repairExistingContractorByEmail(submittedEmail) : null;
      const existingContractor = submittedEmail ? await findExistingContractorByEmail(submittedEmail) : null;

      return NextResponse.json(
        {
          success: false,
          error: "A contractor with that email already exists.",
          contractorId: repaired?.contractorId ??
            (existingContractor && typeof existingContractor.contractorId === "string"
              ? existingContractor.contractorId
              : existingContractor?.id ?? null),
          uid: repaired?.uid ??
            (existingContractor && typeof existingContractor.authUid === "string"
              ? existingContractor.authUid
              : existingContractor?.id ?? null),
        },
        { status: 409 }
      );
    }

    console.error("CREATE CONTRACTOR ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Failed to create contractor" },
      { status: 500 }
    );
  }
}
