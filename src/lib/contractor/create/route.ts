import { NextResponse } from "next/server";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data || !data.name) {
      return NextResponse.json(
        { error: "Missing contractor name" },
        { status: 400 }
      );
    }

    await addDoc(collection(db, "contractors"), {
      ...data,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Create contractor failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
