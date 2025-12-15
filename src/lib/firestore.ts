// src/lib/firestore.ts

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { firebaseApp } from "./firebase";

/* ============================
   FIRESTORE INSTANCE (SAFE)
============================ */

export const db: Firestore | null = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

/* ============================
   TENDERS
============================ */

export function listenTenders(
  callback: (data: any[]) => void
): () => void {
  if (!db) return () => {};

  return onSnapshot(collection(db, "tenders"), (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  });
}

export async function createTender(data: any) {
  if (!db) throw new Error("Firestore not initialized");
  return addDoc(collection(db, "tenders"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/* ============================
   FIX SUGGESTIONS
============================ */

export function listenFixSuggestions(
  tenderId: string,
  callback: (data: any[]) => void
): () => void {
  if (!db) return () => {};

  return onSnapshot(
    collection(db, "tenders", tenderId, "fix_suggestions"),
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    }
  );
}

/* ============================
   ACE ENGINE RESULTS
============================ */

export function listenACEEngine(
  tenderId: string,
  callback: (data: any | null) => void
): () => void {
  if (!db) return () => {};

  return onSnapshot(doc(db, "ace_results", tenderId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

/* ============================
   CONTRACTORS
============================ */

export function listenContractorData(
  contractorId: string,
  callback: (data: any | null) => void
): () => void {
  if (!db) return () => {};

  return onSnapshot(
    doc(db, "contractors", contractorId),
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }
  );
}

export async function createContractor(
  contractorId: string,
  data: any
) {
  if (!db) throw new Error("Firestore not initialized");

  return setDoc(doc(db, "contractors", contractorId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}