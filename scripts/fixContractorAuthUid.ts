import { db } from "@/lib/firebaseAdmin";

async function fixContractors() {
  const snapshot = await db.collection("contractors").get();

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;

    if (!data.authUid) {
      console.log("Fixing contractor:", doc.id);

      await doc.ref.update({
        authUid: doc.id,
      });
    }
  }

  console.log("DONE FIXING CONTRACTORS");
}

void fixContractors();
