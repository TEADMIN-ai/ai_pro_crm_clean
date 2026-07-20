import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export function getLogoutSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.set("session", "", getLogoutSessionCookieOptions());

  return NextResponse.json({ success: true }, { status: 200 });
}
