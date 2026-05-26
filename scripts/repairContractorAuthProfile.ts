import { loadEnvConfig } from "@next/env";

import { ensureContractorAuthLinkage } from "../src/lib/contractors/contractorAuthLink";

loadEnvConfig(process.cwd());

async function main() {
  const uid = process.argv[2]?.trim();

  if (!uid) {
    throw new Error("Usage: tsx scripts/repairContractorAuthProfile.ts <uid>");
  }

  const result = await ensureContractorAuthLinkage({
    uid,
    source: "scripts.repairContractorAuthProfile",
    allowCreateMissingContractor: true,
  });

  console.log("[contractor-linkage] repair_result", result);
}

main().catch((error) => {
  console.error("[contractor-linkage] repair_failed", error);
  process.exitCode = 1;
});
