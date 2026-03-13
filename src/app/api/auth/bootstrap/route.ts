import { NextRequest, NextResponse } from "next/server";
import { getBootstrapUser } from "@/server/services/authService";

function getBearerToken(request: NextRequest): string | undefined {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getBootstrapUser({
      bearerToken: getBearerToken(request),
      sessionCookie: request.cookies.get("session")?.value,
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Auth bootstrap failed:", error);
    return NextResponse.json({ error: "Failed to bootstrap auth" }, { status: 500 });
  }
}
