import { execSync, spawn } from "child_process";
import { createRequire } from "module";
import net from "net";
import { loadEnvConfig } from "@next/env";
import { getFirebaseAdmin } from "../src/lib/firebase/admin";
import { assertValidFirebaseEnv } from "../src/lib/server/validateFirebaseEnv";

const require = createRequire(import.meta.url);
loadEnvConfig(process.cwd());

function run(command: string) {
  execSync(command, { stdio: "inherit" });
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAvailablePort(start = 3111): Promise<number> {
  const tryPort = (port: number) =>
    new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on("error", reject);
      server.listen(port, "127.0.0.1", () => {
        const address = server.address();
        server.close(() => {
          if (address && typeof address === "object") {
            resolve(address.port);
            return;
          }

          reject(new Error(`Could not resolve a port for ${port}`));
        });
      });
    });

  for (let offset = 0; offset < 25; offset += 1) {
    const port = start + offset;

    try {
      return await tryPort(port);
    } catch {
      continue;
    }
  }

  throw new Error("Unable to find an available port for smoke checks");
}

async function runSmokeChecks() {
  console.log("[sanity] building production");
  run("next build");

  console.log("[sanity] starting production server for smoke checks");
  const port = await getAvailablePort();
  const nextCliPath = require.resolve("next/dist/bin/next");

  const server = spawn(process.execPath, [nextCliPath, "start", "-H", "127.0.0.1", "-p", String(port)], {
    stdio: "inherit",
  });

  // Give server time to boot
  await wait(5000);

  try {
    const endpoints = [
      { path: "/api/contractors", allowedStatuses: [401, 403] },
      { path: "/api/deals", allowedStatuses: [401, 403] },
      { path: "/api/auth/health", allowedStatuses: [200, 401, 403] },
      { path: "/api/health/firebase", allowedStatuses: [200, 401, 403] },
      { path: "/api/contractors/smoke-check/documents", allowedStatuses: [200, 401, 403] },
      { path: "/api/documents/smoke-check/execute", allowedStatuses: [200, 404, 405] },
      { path: "/api/vehicle-finance/inventory/connector/health", allowedStatuses: [401, 403] },
      { path: "/api/qs/commercial-intelligence/summary", allowedStatuses: [401, 403] },
      { path: "/api/hygiene", allowedStatuses: [401, 403] },
      { path: "/dashboard/contractors", allowedStatuses: [200, 307, 308] },
      { path: "/dashboard/vehicle-finance", allowedStatuses: [200, 307, 308] },
      { path: "/dashboard/qs", allowedStatuses: [200, 307, 308] },
      { path: "/dashboard/hygiene", allowedStatuses: [200, 307, 308] },
    ];

    for (const endpoint of endpoints) {
      const res = await fetch(`http://127.0.0.1:${port}${endpoint.path}`, {
        redirect: "manual",
      });
      if (!endpoint.allowedStatuses.includes(res.status)) {
        throw new Error(`Smoke check failed for ${endpoint.path} (${res.status})`);
      }
      console.log(`[sanity] smoke ${endpoint.path} -> ${res.status}`);
    }

    console.log("SANITY PASS SAFE TO DEPLOY");
  } finally {
    server.kill("SIGTERM");
    await wait(1000);
  }
}

async function main() {
  console.log("[sanity] firebase env validation");
  assertValidFirebaseEnv();

  console.log("[sanity] firebase admin initialization");
  getFirebaseAdmin();

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
