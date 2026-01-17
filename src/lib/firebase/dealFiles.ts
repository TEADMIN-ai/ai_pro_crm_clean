import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

// ✅ RELATIVE imports (correct)
import { db, storage } from "./index";

export interface DealFileInput {
  dealId: string;
  file: File;
  uploadedBy: string;
  companyId: string;
}

export async function uploadDealFile(input: DealFileInput) {
  const { dealId, file, uploadedBy, companyId } = input;

  // Upload to Firebase Storage
  const storageRef = ref(
    storage,
    `companies/${companyId}/deals/${dealId}/${file.name}`
  );

  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  // Save metadata in Firestore
  await addDoc(collection(db, "dealFiles"), {
    dealId,
    fileName: file.name,
    fileUrl,
    uploadedBy,
    companyId,
    createdAt: serverTimestamp(),
  });
}