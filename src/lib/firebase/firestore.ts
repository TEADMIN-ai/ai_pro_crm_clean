import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

import { db } from "./config";

/**
 * Guard helper
 */
function requireDb() {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  return db;
}

/* =========================
   TENDERS
========================= */

export function listenTenders(
  callback: (data: any[]) => void
) {
  const firestore = requireDb();

  return onSnapshot(
    collection(firestore, "tenders"),
    (snap: QuerySnapshot<DocumentData>) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    }
  );
}

export async function saveTender(data: any) {
  const firestore = requireDb();
  return addDoc(collection(firestore, "tenders"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function deleteTender(tenderId: string) {
  const firestore = requireDb();
  return deleteDoc(doc(firestore, "tenders", tenderId));
}

/* =========================
   CAR SALES
========================= */

export function listenCarSales(
  callback: (data: any[]) => void
) {
  const firestore = requireDb();

  return onSnapshot(
    collection(firestore, "car_sales"),
    (snap: QuerySnapshot<DocumentData>) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    }
  );
}

export async function saveCarSale(data: any) {
  const firestore = requireDb();
  return addDoc(collection(firestore, "car_sales"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/* =========================
   CONTRACTORS (READ ONLY)
========================= */

export function listenContractors(
  callback: (data: any[]) => void
) {
  const firestore = requireDb();

  return onSnapshot(
    collection(firestore, "contractors"),
    (snap: QuerySnapshot<DocumentData>) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    }
  );
}