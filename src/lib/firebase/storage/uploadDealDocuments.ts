import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/client";

export async function uploadDealDocuments(
  dealId: string,
  file: File,
  userId: string
) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed.");
  }

  // Unique path
  const fileRef = ref(storage, `deals/${dealId}/${Date.now()}-${file.name}`);

  // Upload to Firebase Storage
  await uploadBytes(fileRef, file);

  // Get URL
  const downloadURL = await getDownloadURL(fileRef);

  // Save metadata in Firestore
  await addDoc(collection(db, "deals", dealId, "documents"), {
    name: file.name,
    url: downloadURL,
    size: file.size,
    uploadedBy: userId,
    uploadedAt: serverTimestamp(),
  });

  return downloadURL;
}

