import fs from "node:fs";
import path from "node:path";

import { publicRoutes } from "@/lib/corporate/websiteContent";

const root = process.cwd();

describe("Torque Empire public website reliability", () => {
  test("legacy chat route permanently redirects to quote without lead mutation", () => {
    const source = fs.readFileSync(path.join(root, "src/app/chat/page.tsx"), "utf8");

    expect(source).toContain("permanentRedirect(\"/quote\")");
    expect(source).not.toContain("authFetch");
    expect(source).not.toContain("API_ROUTES.LEADS");
    expect(source).not.toContain("fetch(");
    expect(publicRoutes).not.toContain("/chat" as never);
  });

  test("public favicon references use the existing corporate asset", () => {
    expect(fs.existsSync(path.join(root, "public/corporate/logo/favicon.png"))).toBe(true);

    const files = ["src/app/layout.tsx", "src/app/manifest.ts", "public/sw.js", "src/app/login/page.tsx"];
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source).not.toContain("/brand/logo/favicon.png");
      expect(source).toContain("/corporate/logo/favicon.png");
    }
  });

  test("public not-found page offers safe corporate navigation", () => {
    const source = fs.readFileSync(path.join(root, "src/app/not-found.tsx"), "utf8");

    expect(source).toContain("The requested page could not be found.");
    expect(source).toContain("href=\"/\"");
    expect(source).toContain("Go to homepage");
    expect(source).toContain("href=\"/contact\"");
    expect(source).toContain("Contact Torque Empire");
    expect(source).not.toMatch(/dashboard|authFetch|Firebase/i);
  });

  test("public error page exposes retry and home recovery without details", () => {
    const source = fs.readFileSync(path.join(root, "src/app/error.tsx"), "utf8");

    expect(source).toContain("\"use client\"");
    expect(source).toContain("reset: () => void");
    expect(source).toContain("onClick={reset}");
    expect(source).toContain("Try again");
    expect(source).toContain("href=\"/\"");
    expect(source).toContain("Go to homepage");
    expect(source).not.toContain("error.message");
    expect(source).not.toMatch(/stack trace|authFetch|Firebase/i);
  });
});
