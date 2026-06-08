import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Contractor registration is managed by administrators.",
    },
    { status: 410 }
  );
}
