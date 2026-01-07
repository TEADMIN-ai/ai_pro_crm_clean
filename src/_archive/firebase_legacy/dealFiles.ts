import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { storage } from "./config";

export async function uploadDealFile(data: {
  dealId: string;
  file: File;
}) {
  if (!storage) return null;

  const fileRef = ref(
    storage,
    `deal_files/${data.dealId}/${data.file.name}`
  );

  await uploadBytes(fileRef, data.file);
  return getDownloadURL(fileRef);
}

export async function getDealFiles(dealId: string) {
  if (!storage) return [];

  const folderRef = ref(storage, `deal_files/${dealId}`);
  const res = await listAll(folderRef);

  return Promise.all(
    res.items.map(async (item) => ({
      name: item.name,
      url: await getDownloadURL(item),
    }))
  );
}
