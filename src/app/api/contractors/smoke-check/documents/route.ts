import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ smoke: "ok" }, { status: 200 });
}