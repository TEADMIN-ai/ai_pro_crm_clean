import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

export async function uploadDealFile(data: {
  dealId: string;
  file: File;
}): Promise<string> {
  if (!storage) {
    throw new Error("Firebase storage not initialized");
  }

  const filePath = `deal_files/${data.dealId}/${data.file.name}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, data.file);
  return await getDownloadURL(storageRef);
}
