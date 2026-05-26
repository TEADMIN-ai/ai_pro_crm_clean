import { getAuth } from "firebase-admin/auth";

export async function verifyIdToken(token: string) {
  try {
    const decodedToken = await getAuth().verifyIdToken(token);

    return decodedToken;
  } catch (error) {
    console.error("TOKEN VERIFICATION FAILED:", error);
    throw new Error("Invalid or expired token");
  }
}
