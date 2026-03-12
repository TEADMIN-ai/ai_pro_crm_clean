import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getSessionCookieDomain(): string | undefined {
  return process.env.NODE_ENV === "production" ? ".vercel.app" : undefined;
}

export async function POST() {
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
