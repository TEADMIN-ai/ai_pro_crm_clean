import firestoreIndexes from "../../firestore.indexes.json";

type FirestoreIndexField = {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
  arrayConfig?: string;
};

type FirestoreIndex = {
  collectionGroup: string;
  queryScope: string;
  fields: FirestoreIndexField[];
};

function hasIndex(collectionGroup: string, fields: FirestoreIndexField[]) {
  return (firestoreIndexes.indexes as FirestoreIndex[]).some((index) => {
    return index.collectionGroup === collectionGroup
      && index.queryScope === "COLLECTION"
      && JSON.stringify(index.fields) === JSON.stringify(fields);
  });
}

describe("Firestore index configuration", () => {
  test("declares the Tender Intelligence latest-by-deal query index", () => {
    expect(hasIndex("tenderIntelligence", [
      { fieldPath: "dealId", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
      { fieldPath: "__name__", order: "DESCENDING" },
    ])).toBe(true);
  });
});
