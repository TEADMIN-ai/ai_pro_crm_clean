export type FirestoreDb = FirebaseFirestore.Firestore;

export type ReferenceValidation = {
  sourcePath: string;
  referenceField: string;
  targetPath: string;
  exists: boolean;
  sourceExists: boolean;
};

export function splitDocumentPath(path: string): { collection: string; id: string } {
  const [collection, id] = path.split("/");
  if (!collection || !id) {
    throw new Error(`Invalid Firestore document path: ${path}`);
  }

  return { collection, id };
}

export function targetPathFromReference(collection: string, value: string): string {
  return `${collection}/${value}`;
}

export async function validateReference(
  db: FirestoreDb,
  sourcePath: string,
  referenceField: string,
  targetPath: string,
): Promise<ReferenceValidation> {
  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    db.doc(sourcePath).get(),
    db.doc(targetPath).get(),
  ]);

  return {
    sourcePath,
    referenceField,
    targetPath,
    exists: targetSnapshot.exists,
    sourceExists: sourceSnapshot.exists,
  };
}

export async function verifyRepair(
  db: FirestoreDb,
  sourcePath: string,
  referenceField: string,
  targetPath: string,
): Promise<ReferenceValidation> {
  return validateReference(db, sourcePath, referenceField, targetPath);
}
