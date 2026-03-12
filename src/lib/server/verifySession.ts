import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";

export async function verifySessionValue(session: string): Promise<DecodedIdToken | null> {
  if (!session) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    console.log("Session verified:", decoded.uid);
    return decoded;
  } catch (error) {
    console.error("Session verification failed", error);
    return null;
  }
}

export async function verifySession(): Promise<DecodedIdToken | null> {
  const session = (await cookies()).get("session")?.value;

  if (!session) {
    return null;
  }

  return verifySessionValue(session);
}
