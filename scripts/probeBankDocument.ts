import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ getFirebaseStorageBucket }, { extractTextFromPdfDetailed }] = await Promise.all([
    import("../src/lib/firebase/admin"),
    import("../src/lib/pdf/extractTextFromPdf"),
  ]);

  const bucket = getFirebaseStorageBucket();
  const storagePath = "contractors/torque-empire-benchmark/bankConfirmation.pdf";
  const [buffer] = await bucket.file(storagePath).download();
  const result = await extractTextFromPdfDetailed(Buffer.from(buffer), {
    filename: "bankConfirmation.pdf",
  });

  console.log(
    JSON.stringify(
      {
        storagePath,
        source: result.source,
        pageCount: result.pageCount,
        directTextLength: result.directTextLength,
        ocrTextLength: result.ocrTextLength,
        text: result.text,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
