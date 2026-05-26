import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

export async function verifySessionValue(session: string): Promise<DecodedIdToken | null> {
  if (!session) {
    return null;
  }

  try {
    const decoded = await getAuth().verifySessionCookie(session, true);
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
