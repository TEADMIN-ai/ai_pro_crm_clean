import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { getUserById } from "@/server/services/userService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { uid } = await context.params;
    const user = await getUserById(uid);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
