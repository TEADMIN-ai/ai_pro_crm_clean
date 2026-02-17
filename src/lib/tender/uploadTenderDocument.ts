import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuid } from "uuid";
import type { DealDocument } from "@/types/deal";

export async function uploadTenderDocument(
  dealId: string,
  file: File
): Promise<DealDocument> {
  const storage = getStorage();

  const id = uuid();
  const storagePath = `tenders/${dealId}/${id}-${file.name}`;
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

