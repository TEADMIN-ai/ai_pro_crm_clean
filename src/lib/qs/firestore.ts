import { getFirebaseAdmin } from "@/lib/firebase/admin";

type RecordWithId = object;

type ListOptions = {
  limit?: number;
};

function nowIso() {
  return new Date().toISOString();
}

function cleanForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cleanForFirestore(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, cleanForFirestore(entryValue)]),
    ) as T;
  }

  return value;
}

export function normalizeSearchToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildSearchKeywords(...values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    const normalized = value ? normalizeSearchToken(value) : "";
    if (!normalized) {
      continue;
    }

    tokens.add(normalized);
    for (const token of normalized.split(" ")) {
      if (token.length >= 2) {
        tokens.add(token);
      }
    }
  }

  return Array.from(tokens);
}

function collectionRef(collectionName: string) {
  return getFirebaseAdmin().collection(collectionName);
}

export async function listQsRecords<T extends RecordWithId>(
  collectionName: string,
  options: ListOptions = {},
): Promise<T[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const snapshot = await collectionRef(collectionName).limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as unknown as T);
}

export async function getQsRecord<T extends RecordWithId>(
  collectionName: string,
  id: string,
): Promise<T | null> {
  const snapshot = await collectionRef(collectionName).doc(id).get();
  if (!snapshot.exists) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() } as unknown as T;
}

export async function createQsRecord<T extends RecordWithId>(
  collectionName: string,
  idField: keyof T & string,
  payload: Omit<T, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string },
): Promise<T> {
  const payloadRecord = payload as Record<string, unknown>;
  const requestedId = typeof payloadRecord[idField] === "string" ? String(payloadRecord[idField]).trim() : "";
  const docRef = requestedId ? collectionRef(collectionName).doc(requestedId) : collectionRef(collectionName).doc();
  const timestamp = nowIso();
  const record = cleanForFirestore({
    ...payload,
    [idField]: docRef.id,
    createdAt: payload.createdAt ?? timestamp,
    updatedAt: payload.updatedAt ?? timestamp,
  }) as unknown as T;

  await docRef.set(record);
  return record;
}

export async function updateQsRecord<T extends RecordWithId>(
  collectionName: string,
  id: string,
  updates: Partial<T>,
): Promise<T> {
  const docRef = collectionRef(collectionName).doc(id);
  const payload = cleanForFirestore({
    ...updates,
    updatedAt: nowIso(),
  });

  await docRef.set(payload, { merge: true });

  const updated = await getQsRecord<T>(collectionName, id);
  if (!updated) {
    throw new Error(`QS record ${id} was not found after update.`);
  }

  return updated;
}

export async function deleteQsRecord(collectionName: string, id: string): Promise<void> {
  await collectionRef(collectionName).doc(id).delete();
}

export function qsCollection(collectionName: string) {
  return collectionRef(collectionName);
}
