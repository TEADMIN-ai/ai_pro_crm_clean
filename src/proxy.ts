import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/userProfile";
import { isVehicleFinanceRole } from "@/lib/auth/roleUtils";
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
  const role = normalizeRole(decoded?.role);
  if (role === "guest") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isVehicleFinanceRole(role)) {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      return NextResponse.redirect(new URL("/dashboard/vehicle-finance", request.url));
    }

    if (role === "dealerPilot" && pathname.startsWith("/dashboard/vehicle-finance/training")) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    if (!pathname.startsWith("/dashboard/vehicle-finance")) {
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


