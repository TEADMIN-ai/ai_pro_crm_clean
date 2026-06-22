import { NextRequest, NextResponse } from "next/server";
import { isVehicleFinanceRole } from "@/lib/auth/roleUtils";
import { isRoarCarsDashboardPath } from "@/lib/auth/roleRouting";
import { AuthorizationError, resolveAuthorizedIdentity } from "@/lib/server/authz";
import { verifySessionValue } from "@/lib/server/verifySession";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const session = request.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const decoded = await verifySessionValue(session);
  if (!decoded) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let role;
  try {
    role = (await resolveAuthorizedIdentity({
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      role: decoded.role,
      contractorId: decoded.contractorId,
    })).role;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    console.error("[proxy] role resolution failed", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isVehicleFinanceRole(role)) {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      return NextResponse.redirect(new URL("/dashboard/vehicle-finance", request.url));
    }

    if (!isRoarCarsDashboardPath(pathname)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }
  }

  if (pathname.startsWith("/dashboard/hygiene")) {
    if (role !== "admin" && role !== "manager" && role !== "staff") {
      return new NextResponse("Unauthorized", { status: 403 });
    }
  }

  if (pathname === "/dashboard" && role === "contractor") {
    return NextResponse.redirect(new URL("/dashboard/contractor", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};


