import { NextResponse } from "next/server";
import { verifySession } from "@/lib/server/verifySession";

export async function GET() {
  const decoded = await verifySession();

  return NextResponse.json(
    {
      sessionExists: Boolean(decoded),
      userId: decoded?.uid ?? null,
    },
    { status: 200 }
  );
}
