import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";

export type DealFile = {
  id: string;
  dealId: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  companyId: string;
  createdAt?: any;
};

export type DealFileInput = {
  dealId: string;
  file: File;
  uploadedBy: string;
  companyId: string;
};

export async function uploadDealFile(input: DealFileInput) {
  const storagePath = `dealFiles/${input.companyId}/${input.dealId}/${Date.now()}_${input.file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, input.file);
  const url = await getDownloadURL(storageRef);

  const filesRef = collection(db, "deals", input.dealId, "files");
  await addDoc(filesRef, {
    dealId: input.dealId,
    fileName: input.file.name,
    fileUrl: url,
    storagePath,
    uploadedBy: input.uploadedBy,
    companyId: input.companyId,
    createdAt: serverTimestamp(),
  });
}

export async function getDealFiles(dealId: string): Promise<DealFile[]> {
  const filesRef = collection(db, "deals", dealId, "files");
  const q = query(filesRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      dealId,
      fileName: String(data.fileName ?? ""),
      fileUrl: String(data.fileUrl ?? ""),
      uploadedBy: String(data.uploadedBy ?? ""),
      companyId: String(data.companyId ?? ""),
      createdAt: data.createdAt,
    };
  });
}

export async function deleteDealFile(input: { dealId: string; fileId: string; storagePath?: string }) {
  // Optional: if you store storagePath in doc, pass it in to delete from Storage too.
  if (input.storagePath) {
    await deleteObject(ref(storage, input.storagePath));
  }
  // Firestore delete of the doc can be added later if you want strict cleanup.
}

