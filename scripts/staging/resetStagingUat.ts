
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  STAGING_UAT_USERS,
  assertStagingSeedEnvironment,
  buildStagingResetRecordPaths,
  isStagingSyntheticRecord,
  type StagingSeedUser,
} from "@/lib/staging/stagingUatSeedPlan";

const CONFIRM_FLAG = "--confirm-delete-staging-synthetic-data";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function docRef(path: string) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length % 2 !== 0) throw new Error("Invalid document path: " + path);
  let ref = getFirebaseAdmin().collection(segments[0]).doc(segments[1]);
  for (let index = 2; index < segments.length; index += 2) {
    ref = ref.collection(segments[index]).doc(segments[index + 1]);
  }
  return ref;
}

function authUserIsSynthetic(user: UserRecord): boolean {
  const claims = user.customClaims ?? {};
  return isStagingSyntheticRecord(claims as Record<string, unknown>);
}
async function resolveSeedUsers(): Promise<{ users: StagingSeedUser[]; authUsers: UserRecord[] }> {
  const auth = getAuth();
  const users: StagingSeedUser[] = [];
  const authUsers: UserRecord[] = [];

  for (const spec of STAGING_UAT_USERS) {
    try {
      const user = await auth.getUserByEmail(spec.email);
      if (!authUserIsSynthetic(user)) {
        throw new Error("Refusing reset: Auth user lacks staging synthetic claims: " + spec.email);
      }
      users.push({ ...spec, uid: user.uid });
      authUsers.push(user);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Refusing reset")) throw error;
      users.push({ ...spec, uid: "missing-" + spec.key });
    }
  }

  return { users, authUsers };
}

async function inspectRecord(path: string): Promise<{ path: string; exists: boolean; safe: boolean }> {
  const snapshot = await docRef(path).get();
  const data = snapshot.data() as Record<string, unknown> | undefined;
  return { path, exists: snapshot.exists, safe: !snapshot.exists || isStagingSyntheticRecord(data) };
}
async function main(): Promise<void> {
  assertStagingSeedEnvironment(process.env);
  const confirmed = hasFlag(CONFIRM_FLAG);
  const { users, authUsers } = await resolveSeedUsers();
  const paths = buildStagingResetRecordPaths(users);
  const inspections = [];

  for (const path of paths) {
    inspections.push(await inspectRecord(path));
  }

  const unsafe = inspections.filter((item) => item.exists && !item.safe);
  if (unsafe.length > 0) {
    throw new Error("Refusing reset: non-synthetic records found at " + unsafe.map((item) => item.path).join(", "));
  }

  console.log(JSON.stringify({
    mode: confirmed ? "confirmed-delete" : "dry-run",
    firestoreRecordsFound: inspections.filter((item) => item.exists).length,
    firestoreRecordsSafeToDelete: inspections.filter((item) => item.exists && item.safe).map((item) => item.path),
    authUsersSafeToDelete: authUsers.map((user) => ({ uid: user.uid, email: user.email })),
    nextStep: confirmed ? "Deleting exact staging synthetic records." : "Rerun with " + CONFIRM_FLAG + " to delete.",
  }, null, 2));

  if (!confirmed) return;
  let deletedFirestoreRecords = 0;
  for (const item of inspections) {
    if (!item.exists) continue;
    await docRef(item.path).delete();
    deletedFirestoreRecords += 1;
  }

  let deletedAuthUsers = 0;
  for (const user of authUsers) {
    await getAuth().deleteUser(user.uid);
    deletedAuthUsers += 1;
  }

  console.log(JSON.stringify({ deletedFirestoreRecords, deletedAuthUsers }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[staging-uat-reset] failed", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
