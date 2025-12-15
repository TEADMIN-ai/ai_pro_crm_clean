import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Temporary authentication check (C3 mode)
 */
async function verifyAuth(req: NextRequest) {
  const token = req.cookies.get("te_auth_token")?.value;

  if (!token) return null;

  return { uid: "temp-user" };
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  const protectedRoutes = [
    "/dashboard",
    "/tenders",
    "/contractor",
    "/staff",
    "/carsales",
    "/ace",
  ];

  const user = await verifyAuth(req);

  if (
    !user &&
    protectedRoutes.some((path) => url.pathname.startsWith(path))
  ) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tenders/:path*",
    "/contractor/:path*",
    "/staff/:path*",
    "/carsales/:path*",
    "/ace/:path*",
  ],
};