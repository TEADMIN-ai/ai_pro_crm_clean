import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

/**
 * GET SINGLE CONTRACTOR
 * -----------------------------------------
 * Returns normalized contractor response
 * required by dashboard + execution layer
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { contractorId: string } }
) {
  try {
    const { contractorId } = params;

    if (!contractorId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing contractorId",
        },
        { status: 400 }
      );
    }

    const contractorRef = db
      .collection("contractors")
      .doc(contractorId);

    const contractorSnap = await contractorRef.get();

    if (!contractorSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Contractor not found",
        },
        { status: 404 }
      );
    }

    const contractorData = contractorSnap.data();

    /**
     * NORMALIZED RESPONSE FORMAT
     * Frontend expects THIS EXACT SHAPE
     */
    return NextResponse.json({
      success: true,
      contractor: {
        id: contractorSnap.id,
        ...contractorData,
      },
    });
  } catch (error) {
    console.error("GET Contractor Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * UPDATE CONTRACTOR
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { contractorId: string } }
) {
  try {
    const { contractorId } = params;

    const body = await req.json();

    if (!contractorId) {
      return NextResponse.json(
        { success: false, error: "Missing contractorId" },
        { status: 400 }
      );
    }

    await db
      .collection("contractors")
      .doc(contractorId)
      .update({
        ...body,
        updatedAt: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      message: "Contractor updated successfully",
    });
  } catch (error) {
    console.error("PATCH Contractor Error:", error);

    return NextResponse.json(
      { success: false, error: "Update failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE CONTRACTOR
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { contractorId: string } }
) {
  try {
    const { contractorId } = params;

    if (!contractorId) {
      return NextResponse.json(
        { success: false, error: "Missing contractorId" },
        { status: 400 }
      );
    }

    await db
      .collection("contractors")
      .doc(contractorId)
      .delete();

    return NextResponse.json({
      success: true,
      message: "Contractor deleted",
    });
  } catch (error) {
    console.error("DELETE Contractor Error:", error);

    return NextResponse.json(
      { success: false, error: "Delete failed" },
      { status: 500 }
    );
  }
}