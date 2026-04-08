import { verifyIdToken } from "@/lib/auth";

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split("Bearer ")[1];

  const decoded = await verifyIdToken(token);

  if (!decoded) {
    throw new Error("Invalid token");
  }

  return decoded;
}
