import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function createTenderPackRecord(input: {
  storagePath: string;
  downloadURL: string;
  createdAt: number;
  createdBy: string;
  contractorId: string;
  templateKey: string;
  missingFields: string[];
  warnings: string[];
  fieldMapUsed: Record<string, string>;
}) {
  const packRef = await getFirebaseAdmin().collection("tenderPacks").add(input);
  return packRef.id;
}
