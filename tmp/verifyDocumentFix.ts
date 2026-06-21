import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const deploymentUrl = "https://ai-pro-crm-clean.vercel.app";
const login = JSON.parse(readFileSync(path.join(process.cwd(), "secure", "admin-signin-request.json"), "utf8")) as {
  email: string;
  password: string;
};

const outDir = path.join(process.cwd(), "output", "document-verification-fix");
mkdirSync(outDir, { recursive: true });

const mustNotContain = async (page: any, text: string, label: string) => {
  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  if (bodyText.includes(text)) {
    throw new Error(`${label} contains unexpected text: ${text}`);
  }
};

const clickLogin = async (page: any) => {
  const button = page.getByRole("button", { name: /login|sign in/i });
  await button.first().click();
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("[browser-console-error]", msg.text());
    }
  });

  await page.goto(`${deploymentUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByPlaceholder("Email").fill(login.email);
  await page.getByPlaceholder("Password").fill(login.password);
  await clickLogin(page);
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(3000);

  const dashboardPath = new URL(page.url()).pathname;
  if (dashboardPath === "/login" || dashboardPath === "/") {
    throw new Error(`Login did not redirect to a dashboard route. Current URL: ${page.url()}`);
  }

  const docPage = await context.newPage();
  await docPage.goto(`${deploymentUrl}/dashboard/vehicle-finance/document-verification`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await docPage.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
  await docPage.waitForTimeout(2000);
  await docPage.screenshot({ path: path.join(outDir, "document-verification.png"), fullPage: true });
  await mustNotContain(docPage, "Vehicle finance timeline unavailable", "document verification page");
  await mustNotContain(docPage, "Minified React error", "document verification page");

  const applicationsPage = await context.newPage();
  await applicationsPage.goto(`${deploymentUrl}/dashboard/vehicle-finance/applications`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await applicationsPage.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
  await applicationsPage.screenshot({ path: path.join(outDir, "applications.png"), fullPage: true });

  const inventoryPage = await context.newPage();
  await inventoryPage.goto(`${deploymentUrl}/dashboard/vehicle-finance/inventory`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await inventoryPage.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
  await inventoryPage.screenshot({ path: path.join(outDir, "inventory.png"), fullPage: true });
  const inventoryText = await inventoryPage.locator("body").innerText({ timeout: 10000 });
  if (!/Roar/i.test(inventoryText)) {
    throw new Error("Inventory page does not appear to show Roar inventory");
  }

  const listingsPage = await context.newPage();
  await listingsPage.goto(`${deploymentUrl}/dashboard/vehicle-finance/listings`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await listingsPage.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
  await listingsPage.screenshot({ path: path.join(outDir, "listings.png"), fullPage: true });

  const roarResponse = await context.request.get(`${deploymentUrl}/api/vehicle-finance/roar-inventory`);
  const roarStatus = roarResponse.status();
  if (roarStatus !== 200) {
    throw new Error(`Roar inventory API returned ${roarStatus}`);
  }
  const roarJson = await roarResponse.json();
  const roarCount = Array.isArray(roarJson?.items) ? roarJson.items.length : Array.isArray(roarJson) ? roarJson.length : 0;

  console.log(JSON.stringify({
    loginUrl: page.url(),
    dashboardPath,
    roarStatus,
    roarCount,
  }));

  await browser.close();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
