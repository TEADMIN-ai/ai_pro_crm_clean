import { execSync, spawn } from "child_process";

function run(command: string) {
  execSync(command, { stdio: "inherit" });
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSmokeChecks() {
  console.log("[sanity] building production");
  run("next build");

  console.log("[sanity] starting production server for smoke checks");

  const server = spawn("npx", ["next", "start", "-p", "3111"], {
    stdio: "inherit",
    shell: true,
  });

  // Give server time to boot
  await wait(5000);

  try {
    const endpoints = [
      "/api/contractors",
      "/api/deals",
      "/api/contractors/smoke-check/documents",
      "/api/documents/smoke-check/execute",
      "/dashboard/contractors",
    ];

    for (const path of endpoints) {
      const res = await fetch(`http://127.0.0.1:3111${path}`);
      if (!res.ok) {
        throw new Error(`Smoke check failed for ${path} (${res.status})`);
      }
      console.log(`[sanity] smoke ${path} -> ${res.status}`);
    }

    console.log("SANITY PASS SAFE TO DEPLOY");
  } finally {
    server.kill();
  }
}

async function main() {
  console.log("[sanity] typecheck");
  run("npm run typecheck");

  console.log("[sanity] test");
  run("npm run test");

  console.log("[sanity] route integrity");
  run("npm run route:integrity");

  await runSmokeChecks();
}

main().catch((err) => {
  console.error("Sanity failed:", err);
  process.exit(1);
});