import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuid } from "uuid";
import type { DealDocument } from "@/types/deal";
import { auth } from "@/lib/firebase/client";

export async function uploadTenderDocument(
  dealId: string,
  file: File
): Promise<DealDocument> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Authentication required to upload tender documents.");
  }

  const storage = getStorage();

  const id = uuid();
  const safeFileName = file.name.replace(/[\/\\]/g, "_");
  const storagePath = `tenders/${user.uid}/${dealId}/${id}-${safeFileName}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  return {
    id,
    name: file.name,
    url,
    storagePath,
    uploadedAt: new Date(),
  };
}

