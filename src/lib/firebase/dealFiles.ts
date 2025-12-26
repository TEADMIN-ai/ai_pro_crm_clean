import { db } from './config';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

const storage = getStorage();

export async function uploadDealFile(data: {
  dealId: string;
  file: File;
  userId: string;
  userEmail: string;
}) {
  const storageRef = ref(
    storage,
    \deal_files/\/\-\\
  );

  await uploadBytes(storageRef, data.file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, 'deal_files'), {
    dealId: data.dealId,
    fileName: data.file.name,
    fileUrl: url,
    uploadedBy: data.userId,
    userEmail: data.userEmail,
    createdAt: serverTimestamp(),
  });
}

export async function getDealFiles(dealId: string) {
  const q = query(
    collection(db, 'deal_files'),
    where('dealId', '==', dealId)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

