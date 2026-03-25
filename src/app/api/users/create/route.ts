import { NextRequest, NextResponse } from "next/server";
import {
  createManagedUser,
  CreateUserValidationError,
  type CreateUserInput,
} from "@/lib/users/user.service";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);

    if (actor.role !== "admin") {
      throw new AuthorizationError("unauthorized", 403);
    }

    const body = (await request.json()) as Partial<CreateUserInput>;
    const result = await createManagedUser({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      role: body.role as CreateUserInput["role"],
    });

    return NextResponse.json(
      {
        success: true,
        user: result.user,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    if (error instanceof CreateUserValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (error instanceof Error) {
      const duplicateEmail =
        "code" in error &&
        typeof error.code === "string" &&
        error.code === "auth/email-already-exists";

      if (duplicateEmail) {
        return NextResponse.json(
          { success: false, error: "A user with that email already exists." },
          { status: 409 },
        );
      }
    }

    console.error("Failed to create user:", error);
    return NextResponse.json({ success: false, error: "Failed to create user" }, { status: 500 });
  }
}
