import { loadEnvConfig } from "@next/env";
import { getFirebaseAdmin } from "../src/lib/firebase/admin";

loadEnvConfig(process.cwd());

const DOCUMENT_ID = "smoke-check";
const payload = {
  fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  contractorId: "test-contractor-1",
  createdAt: new Date().toISOString(),
};

async function main() {
  const db = getFirebaseAdmin();

  await db.collection("documents").doc(DOCUMENT_ID).set(payload);

  console.log(
    JSON.stringify(
      {
        collection: "documents",
        documentId: DOCUMENT_ID,
        payload,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Failed to insert smoke-check document:", error);
  process.exit(1);
});
