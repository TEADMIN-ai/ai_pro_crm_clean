import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { listUsers } from "@/server/services/userService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const users = await listUsers();
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
