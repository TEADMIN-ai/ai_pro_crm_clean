import { runEntityCheck } from "./entityCheck";

export async function runSanityCheck(): Promise<void> {
  await runEntityCheck();
  console.log("[sanity-check] OK");
}

async function main(): Promise<void> {
  await runSanityCheck();
}

if (process.argv[1]?.endsWith("sanityCheck.ts") || process.argv[1]?.endsWith("sanityCheck.js")) {
  main().catch((error: unknown) => {
    console.error("[sanity-check] Failed:", error);
    process.exitCode = 1;
  });
}
