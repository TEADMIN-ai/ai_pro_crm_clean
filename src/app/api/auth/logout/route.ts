import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/requireAuth";

function getSessionCookieDomain(): string | undefined {
  return process.env.NODE_ENV === "production" ? ".vercel.app" : undefined;
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();

  cookieStore.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    domain: getSessionCookieDomain(),
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
