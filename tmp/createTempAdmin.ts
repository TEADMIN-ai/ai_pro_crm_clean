import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rootDir = process.cwd();
const serviceAccountPath = path.join(rootDir, "secure", "serviceAccount.json");
const passwordPath = path.join(rootDir, "secure", "admin-temp-password.txt");

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as ServiceAccount;

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const auth = getAuth();
const db = getFirestore();

const email = `codex-admin-verification-${Date.now()}@example.com`;
const password = `Tmp!${randomBytes(18).toString("base64url")}`;

writeFileSync(passwordPath, password, { encoding: "utf8" });

const main = async () => {
  const userRecord = await auth.createUser({
    email,
    password,
    displayName: "TEMP ADMIN VERIFICATION",
    emailVerified: true,
    disabled: false,
  });

  await auth.setCustomUserClaims(userRecord.uid, {
    role: "admin",
    contractorId: null,
  });

  await db.collection("users").doc(userRecord.uid).set({
    uid: userRecord.uid,
    name: "TEMP ADMIN VERIFICATION",
    email,
    role: "admin",
    status: "test-admin-verification",
    createdAt: Date.now(),
  });

  console.log(JSON.stringify({ uid: userRecord.uid, email, passwordPath }));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
