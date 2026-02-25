import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`[envCheck] Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("[envCheck] All required Firebase Admin environment variables are present.");
