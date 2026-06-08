import { loadEnvConfig } from "@next/env";
import { assertValidFirebaseEnv } from "../src/lib/server/validateFirebaseEnv";

loadEnvConfig(process.cwd());
const result = assertValidFirebaseEnv();
console.log("[envCheck] Firebase Admin environment variables are valid.", {
  credentialSource: result.credentialSource,
});
