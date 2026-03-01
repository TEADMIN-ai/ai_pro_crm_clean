import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";
const npmBin = isWindows ? "npm.cmd" : "npm";

type CommandResult = {
  code: number;
};

function run(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1 }));
  });
}

async function runStep(label: string, args: string[]) {
  console.log(`\n[sanity] ${label}`);
  const result = await run(npmBin, args);
  if (result.code !== 0) {
    throw new Error(`${label} failed with exit code ${result.code}`);
  }
}

async function waitForServer(baseUrl: string, timeoutMs: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/contractors`, { method: "GET" });
      if (response.status > 0) return;
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  throw new Error(`Dev server did not become ready within ${timeoutMs}ms`);
}

async function isReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/contractors`, { method: "GET" });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function smokeCheckEndpoint(
  baseUrl: string,
  routePath: string,
  expectedStatus?: number
): Promise<void> {
  const response = await fetch(`${baseUrl}${routePath}`, { method: "GET" });

  if (typeof expectedStatus === "number" && response.status !== expectedStatus) {
    throw new Error(
      `Smoke check failed for ${routePath}: expected ${expectedStatus}, got ${response.status}`
    );
  }

  if (response.status === 404) {
    throw new Error(`Smoke check failed for ${routePath}: returned 404`);
  }

  if (response.status >= 500) {
    throw new Error(`Smoke check failed for ${routePath}: server error ${response.status}`);
  }

  console.log(`[sanity] smoke ${routePath} -> ${response.status}`);
}

const PAGE_SMOKE_ROUTES = ["/dashboard/contractors"] as const;

async function smokeCheckPageEndpoint(baseUrl: string, routePath: string): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}${routePath}`, {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
    });

    if (response.status >= 500) {
      console.warn(`[sanity] warning page smoke ${routePath} -> server error ${response.status}`);
      return;
    }

    console.log(`[sanity] page smoke ${routePath} -> ${response.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[sanity] warning page smoke ${routePath} failed: ${message}`);
  }
}

async function runOptionalPageSmokeChecks(baseUrl: string): Promise<void> {
  console.log(`[sanity] optional page smoke checks against ${baseUrl}`);
  for (const routePath of PAGE_SMOKE_ROUTES) {
    await smokeCheckPageEndpoint(baseUrl, routePath);
  }
}

async function runSmokeChecks(): Promise<void> {
  const baseUrl = process.env.SANITY_BASE_URL;

  if (baseUrl) {
    console.log(`\n[sanity] smoke checks against ${baseUrl}`);
    await smokeCheckEndpoint(baseUrl, "/api/contractors");
    await smokeCheckEndpoint(baseUrl, "/api/deals");
    await smokeCheckEndpoint(baseUrl, "/api/contractors/smoke-check/documents");
    await smokeCheckEndpoint(baseUrl, "/api/documents/smoke-check/execute", 200);
    await runOptionalPageSmokeChecks(baseUrl);
    return;
  }

  const commonUrls = ["http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3111"];
  for (const url of commonUrls) {
    if (await isReachable(url)) {
      console.log(`\n[sanity] smoke checks against existing server ${url}`);
      await smokeCheckEndpoint(url, "/api/contractors");
      await smokeCheckEndpoint(url, "/api/deals");
      await smokeCheckEndpoint(url, "/api/contractors/smoke-check/documents");
      await smokeCheckEndpoint(url, "/api/documents/smoke-check/execute", 200);
      await runOptionalPageSmokeChecks(url);
      return;
    }
  }

  const port = Number(process.env.SANITY_PORT ?? "3111");
  const localUrl = `http://127.0.0.1:${port}`;
  const lockPath = path.join(process.cwd(), ".next", "dev", "lock");

  if (fs.existsSync(lockPath)) {
    if (await isReachable(localUrl)) {
      console.log(`\n[sanity] smoke checks against existing server ${localUrl}`);
      await smokeCheckEndpoint(localUrl, "/api/contractors");
      await smokeCheckEndpoint(localUrl, "/api/deals");
      await smokeCheckEndpoint(localUrl, "/api/contractors/smoke-check/documents");
      await smokeCheckEndpoint(localUrl, "/api/documents/smoke-check/execute", 200);
      await runOptionalPageSmokeChecks(localUrl);
      return;
    }

    // Recover from stale lock files left by interrupted dev servers.
    try {
      fs.unlinkSync(lockPath);
      console.log(`\n[sanity] removed stale dev lock at ${lockPath}`);
    } catch (error) {
      throw new Error(
        `Detected a Next.js dev lock and could not remove it (${error instanceof Error ? error.message : String(error)}).`
      );
    }
  }

  console.log(`\n[sanity] starting dev server on ${localUrl} for smoke checks`);

  const devChild = spawn(npmBin, ["run", "dev", "--", "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: process.env,
  });

  devChild.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  devChild.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));

  try {
    await waitForServer(localUrl, 60_000);
    await smokeCheckEndpoint(localUrl, "/api/contractors");
    await smokeCheckEndpoint(localUrl, "/api/deals");
    await smokeCheckEndpoint(localUrl, "/api/contractors/smoke-check/documents");
    await smokeCheckEndpoint(localUrl, "/api/documents/smoke-check/execute", 200);
    await runOptionalPageSmokeChecks(localUrl);
  } finally {
    devChild.kill("SIGTERM");
  }
}

async function main() {
  try {
    await runStep("typecheck", ["run", "typecheck"]);
    await runStep("test", ["run", "test"]);
    await runStep("route integrity", ["run", "route:integrity"]);
    await runSmokeChecks();

    console.log("\nSANITY PASS SAFE TO DEPLOY");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nSANITY FAIL: ${message}`);
    process.exit(1);
  }
}

main();
