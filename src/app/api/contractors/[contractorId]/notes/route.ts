import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  assertCanAccessContractor,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import {
  createContractorCommandNote,
  listContractorCommandNotes,
  type ContractorNoteType,
} from "@/server/services/contractorCommandCenterService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseNoteType(value: unknown): ContractorNoteType | null {
  switch (value) {
    case "INFO":
    case "ACTION_REQUIRED":
    case "CLIENT_CONTACT":
    case "APPROVAL":
    case "WARNING":
    case "REJECTION":
      return value;
    default:
      return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await params;
    if (!contractorId) return jsonError("Missing contractorId", 400);

    assertCanAccessContractor(user, contractorId);
    assertPrivilegedRole(user);

    const notes = await listContractorCommandNotes(contractorId);
    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }
    console.error("[contractor-notes] list failed", error);
    return jsonError("Failed to load contractor notes", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const noteType = parseNoteType(body.noteType);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!contractorId) return jsonError("Missing contractorId", 400);
    if (!noteType) return jsonError("Invalid noteType", 400);
    if (!title) return jsonError("Title is required", 400);
    if (!message) return jsonError("Message is required", 400);

    assertCanAccessContractor(user, contractorId);
    assertPrivilegedRole(user);

    const note = await createContractorCommandNote({
      contractorId,
      noteType,
      title,
      message,
      actor: user,
    });

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }
    console.error("[contractor-notes] create failed", error);
    return jsonError("Failed to create contractor note", 500);
  }
}
