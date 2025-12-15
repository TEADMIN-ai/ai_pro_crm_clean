const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");

const REQUIRED_APP_FILES = [
  "app/page.jsx",
  "app/layout.jsx"
];

const REQUIRED_ROUTE_SHAPE = {
  name: "tenders",
  files: ["page.jsx"]
};

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function isReactComponent(file) {
  const content = fs.readFileSync(file, "utf8");
  return (
    content.includes("export default function") ||
    content.includes("export default () =>")
  );
}

function scan() {
  console.log("\n🩺 Next.js App Router Doctor\n");

  // 1. Check app dir
  if (!exists("app")) {
    console.error("❌ Missing /app directory");
    fs.mkdirSync(APP_DIR);
    console.log("✅ Created /app");
  }

  // 2. Required core files
  for (const file of REQUIRED_APP_FILES) {
    if (!exists(file)) {
      console.error(`❌ Missing ${file}`);
      fs.writeFileSync(
        path.join(ROOT, file),
        file.includes("layout")
          ? `export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}`
          : `export default function Home() {
  return <h1>AI Pro CRM 🚀</h1>;
}`
      );
      console.log(`✅ Created ${file}`);
    }
  }

  // 3. Route check (tenders)
  const routePath = path.join(APP_DIR, REQUIRED_ROUTE_SHAPE.name);
  if (!fs.existsSync(routePath)) {
    console.error(`❌ Missing route folder: /app/${REQUIRED_ROUTE_SHAPE.name}`);
    fs.mkdirSync(routePath);
    console.log(`✅ Created /app/${REQUIRED_ROUTE_SHAPE.name}`);
  }

  for (const file of REQUIRED_ROUTE_SHAPE.files) {
    const full = path.join(routePath, file);
    if (!fs.existsSync(full)) {
      console.error(`❌ Missing ${file} in /app/${REQUIRED_ROUTE_SHAPE.name}`);
      fs.writeFileSync(
        full,
        `"use client";

export default function ${REQUIRED_ROUTE_SHAPE.name
          .charAt(0)
          .toUpperCase() + REQUIRED_ROUTE_SHAPE.name.slice(1)}Page() {
  return <h1>${REQUIRED_ROUTE_SHAPE.name} works</h1>;
}`
      );
      console.log(`✅ Created ${full}`);
    } else {
      if (!isReactComponent(full)) {
        console.error(`❌ ${full} is NOT a valid React component`);
      } else {
        console.log(`✅ ${full} looks valid`);
      }
    }
  }

  console.log("\n✅ Doctor scan complete\n");
}

scan();