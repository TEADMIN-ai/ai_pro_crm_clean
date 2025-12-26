import { NextResponse } from "next/server";
import { saveContractorToFirestore } from "@/lib/contractor/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Generate ID if not supplied
    const contractorId =
      body.contractorId ||
      body.id ||
      crypto.randomUUID();

    await saveContractorToFirestore(contractorId, body);

    return NextResponse.json({
      success: true,
      contractorId,
    });
  } catch (err) {
    console.error("CREATE CONTRACTOR ERROR:", err);

    return NextResponse.json(
      {
        success: false,
        error: String(err),
      },
      { status: 500 }
    );
  }
}

