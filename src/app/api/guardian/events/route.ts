import { NextResponse } from "next/server";

import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";

export async function GET() {
  try {
    return NextResponse.json(
      {
        success: true,
        events: GuardianMonitor.getRecentEvents(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: true,
        events: [],
      },
      { status: 200 }
    );
  }
}
