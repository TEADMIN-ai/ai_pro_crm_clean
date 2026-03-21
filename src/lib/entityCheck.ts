export async function runEntityCheck(): Promise<void> {
  console.log("[entity-check] OK");
}

async function main(): Promise<void> {
  await runEntityCheck();
}

if (process.argv[1]?.endsWith("entityCheck.ts") || process.argv[1]?.endsWith("entityCheck.js")) {
  main().catch((error: unknown) => {
    console.error("[entity-check] Failed:", error);
    process.exitCode = 1;
  });
}
