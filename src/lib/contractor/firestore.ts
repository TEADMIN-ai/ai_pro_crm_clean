import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  DocumentData,
} from "firebase/firestore";

/**
 * Prevents undefined or empty IDs from breaking Firestore queries.
 */
function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Listen for FIX SUGGESTIONS
 */
export function listenFixSuggestions(
  tenderId: string | undefined,
  callback: (data: DocumentData[] | null) => void
): Unsubscribe | null {
  if (!isValidId(tenderId)) {
    console.warn("listenFixSuggestions skipped — invalid tenderId:", tenderId);
    callback(null);
    return null;
  }

  const ref = collection(db, "fixSuggestions");
  const q = query(ref, where("tenderId", "==", tenderId));

  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(rows);
  });
}

/**
 * Listen for ACE ENGINE OUTPUT
 */
export function listenACEEngine(
  tenderId: string | undefined,
  callback: (data: DocumentData[] | null) => void
): Unsubscribe | null {
  if (!isValidId(tenderId)) {
    console.warn("listenACEEngine skipped — invalid tenderId:", tenderId);
    callback(null);
    return null;
  }

  const ref = collection(db, "aceEngine");
  const q = query(ref, where("tenderId", "==", tenderId));

  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(rows);
  });
}

