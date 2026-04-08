import "@/lib/firebaseAdmin";
import admin from "firebase-admin";

export async function verifyIdToken(token: string) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    return decodedToken;
  } catch (error) {
    console.error("TOKEN VERIFICATION FAILED:", error);
    throw new Error("Invalid or expired token");
  }
}
