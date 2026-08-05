
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  STAGING_SEED_CREATED_BY,
  STAGING_SEED_VERSION,
  STAGING_UAT_USERS,
  assertStagingSeedEnvironment,
  buildStagingUatSeedPlan,
  isStagingSyntheticRecord,
  validateStagingPasswords,
  type StagingSeedUser,
  type StagingUserSpec,
} from "@/lib/staging/stagingUatSeedPlan";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    ) as T;
  }
  return value;
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
async function ensureAuthUser(spec: StagingUserSpec): Promise<StagingSeedUser> {
  const auth = getAuth();
  const password = process.env[spec.passwordEnv]?.trim();
  if (!password) throw new Error(spec.passwordEnv + " is required.");

  let user: UserRecord;
  try {
    user = await auth.getUserByEmail(spec.email);
  } catch {
    user = await auth.createUser({
      email: spec.email,
      password,
      displayName: spec.displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: spec.key,
    environment: "staging",
    syntheticData: true,
    seedVersion: STAGING_SEED_VERSION,
    createdBy: STAGING_SEED_CREATED_BY,
  });

  return { ...spec, uid: user.uid };
}

async function setSeedRecord(path: string, data: Record<string, unknown>): Promise<"created" | "updated"> {
  const ref = docRef(path);
  const snapshot = await ref.get();
  if (snapshot.exists && !isStagingSyntheticRecord(snapshot.data() as Record<string, unknown> | undefined)) {
    throw new Error("Refusing to overwrite non-staging synthetic record: " + path);
  }
  await ref.set(stripUndefined(data), { merge: true });
  return snapshot.exists ? "updated" : "created";
}
async function main(): Promise<void> {
  const apply = hasFlag("--apply");
  assertStagingSeedEnvironment(process.env);

  if (!apply) {
    const dryUsers = STAGING_UAT_USERS.map((user) => ({ ...user, uid: "dry-run-" + user.key }));
    const plan = buildStagingUatSeedPlan(dryUsers);
    console.log(JSON.stringify({
      mode: "dry-run",
      seedVersion: plan.seedVersion,
      users: plan.users.map((user) => ({ key: user.key, email: user.email, passwordEnv: user.passwordEnv })),
      records: plan.records.map((record) => record.path),
      nextStep: "Set temporary password env vars and rerun with --apply.",
    }, null, 2));
    return;
  }

  validateStagingPasswords(process.env);
  const users: StagingSeedUser[] = [];
  for (const spec of STAGING_UAT_USERS) {
    users.push(await ensureAuthUser(spec));
  }

  const plan = buildStagingUatSeedPlan(users);
  const results: Record<string, number> = { created: 0, updated: 0 };
  for (const record of plan.records) {
    const result = await setSeedRecord(record.path, record.data);
    results[result] += 1;
  }

  console.log(JSON.stringify({
    mode: "applied",
    seedVersion: plan.seedVersion,
    users: users.map((user) => ({ key: user.key, email: user.email, uid: user.uid })),
    records: results,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[staging-uat-seed] failed", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
