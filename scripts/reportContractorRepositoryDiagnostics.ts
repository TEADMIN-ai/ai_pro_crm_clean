import fs from "node:fs";
import path from "node:path";
type FirebaseAdminModule = typeof import("../src/lib/firebase/admin");

let firebaseAdminModule: FirebaseAdminModule | null = null;

async function getAdminModule() {
  firebaseAdminModule ??= await import("../src/lib/firebase/admin");
  return firebaseAdminModule;
}

async function getDb() {
  return (await getAdminModule()).getFirebaseAdmin();
}

async function getBucket() {
  return (await getAdminModule()).getFirebaseStorageBucket();
}

async function getBucketName() {
  return (await getAdminModule()).getFirebaseStorageBucketName();
}

async function getAdminAuth() {
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth();
}

type RecordHit = {
  collection: string;
  id: string;
  matchedTerms: string[];
  displayName: string | null;
  workspaceId: string | null;
  contractorId: string | null;
  uid: string | null;
};

type CollectionReport = {
  collection: string;
  exists: boolean;
  count: number;
  contractorLikeCount: number;
  withoutWorkspaceId: number;
  duplicateBusinessNames: Array<{ name: string; ids: string[] }>;
  hits: RecordHit[];
};

const SEARCH_TERMS = [
  "Mackay",
  "Mackay and Daughters",
  "Mackay & Daughters",
  "F.E. Miller Pools",
  "FE Miller Pools",
  "F E Miller",
  "Miller Pools",
];

const COLLECTIONS = [
  "contractors",
  "contractorProfiles",
  "users",
  "organisations",
  "organizations",
  "clients",
  "accounts",
  "workspaceMembers",
  "onboardingApplications",
  "contractorApplications",
  "leads",
  "submissions",
  "deals",
  "archivedContractors",
  "legacyContractors",
  "auditEvents",
  "auditLogs",
  "onboardingAcknowledgements",
  "acknowledgements",
  "complianceRecords",
  "tenderPacks",
  "documentAnalysis",
  "contractorDocuments",
];

const SEARCH_FIELDS = [
  "companyName",
  "businessName",
  "legalName",
  "tradingName",
  "name",
  "displayName",
  "contractorName",
  "organisationName",
  "organizationName",
  "email",
  "phone",
  "uid",
  "authUid",
  "userId",
  "contractorId",
  "linkedContractorId",
  "contractorUid",
  "contractorUserId",
];

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesSearchTerms(text: string): string[] {
  const normalizedText = normalize(text);
  return SEARCH_TERMS.filter((term) => {
    const normalizedTerm = normalize(term);
    return normalizedTerm.length > 0 && normalizedText.includes(normalizedTerm);
  });
}

function collectText(data: Record<string, unknown>): string {
  const values: string[] = [];

  for (const field of SEARCH_FIELDS) {
    const value = data[field];
    if (typeof value === "string") {
      values.push(value);
    }
  }

  return values.join(" ");
}

function displayName(data: Record<string, unknown>): string | null {
  return (
    asString(data.companyName) ??
    asString(data.businessName) ??
    asString(data.legalName) ??
    asString(data.tradingName) ??
    asString(data.name) ??
    asString(data.displayName) ??
    asString(data.contractorName)
  );
}

function isContractorLike(data: Record<string, unknown>): boolean {
  return Boolean(
    asString(data.contractorId) ??
      asString(data.contractorName) ??
      asString(data.companyName) ??
      asString(data.businessName),
  );
}

function duplicateBusinessNames(records: Array<{ id: string; data: Record<string, unknown> }>) {
  const groups = new Map<string, { name: string; ids: string[] }>();

  for (const record of records) {
    const name = displayName(record.data);
    if (!name) {
      continue;
    }

    const key = normalize(name);
    const group = groups.get(key) ?? { name, ids: [] };
    group.ids.push(record.id);
    groups.set(key, group);
  }

  return [...groups.values()].filter((group) => group.ids.length > 1);
}

async function inspectCollection(collection: string): Promise<CollectionReport> {
  const snapshot = await (await getDb()).collection(collection).limit(1000).get();
  const records = snapshot.docs.map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> }));
  const hits = records
    .map((record) => {
      const matchedTerms = matchesSearchTerms(`${record.id} ${collectText(record.data)}`);
      if (!matchedTerms.length) {
        return null;
      }

      return {
        collection,
        id: record.id,
        matchedTerms,
        displayName: displayName(record.data),
        workspaceId: asString(record.data.workspaceId),
        contractorId: asString(record.data.contractorId),
        uid: asString(record.data.uid) ?? asString(record.data.authUid) ?? asString(record.data.userId),
      };
    })
    .filter((hit): hit is RecordHit => hit !== null);

  return {
    collection,
    exists: !snapshot.empty,
    count: records.length,
    contractorLikeCount: records.filter((record) => isContractorLike(record.data)).length,
    withoutWorkspaceId: records.filter((record) => isContractorLike(record.data) && !asString(record.data.workspaceId)).length,
    duplicateBusinessNames: duplicateBusinessNames(records),
    hits,
  };
}

async function inspectAuthUsers(contractorIds: Set<string>) {
  const authHits: Array<{ uid: string; displayName: string | null; email: string | null; matchedTerms: string[]; hasContractorDocument: boolean }> = [];
  let authOnlyContractorUsers = 0;
  let pageToken: string | undefined;

  do {
    const result = await (await getAdminAuth()).listUsers(1000, pageToken);
    for (const user of result.users) {
      const role = typeof user.customClaims?.role === "string" ? user.customClaims.role : null;
      const contractorId = typeof user.customClaims?.contractorId === "string" ? user.customClaims.contractorId : user.uid;
      if (role === "contractor" && !contractorIds.has(contractorId)) {
        authOnlyContractorUsers += 1;
      }

      const matchedTerms = matchesSearchTerms(`${user.uid} ${user.displayName ?? ""} ${user.email ?? ""}`);
      if (matchedTerms.length) {
        authHits.push({
          uid: user.uid,
          displayName: user.displayName ?? null,
          email: user.email ? user.email.replace(/^(.).+(@.*)$/, "$1***$2") : null,
          matchedTerms,
          hasContractorDocument: contractorIds.has(contractorId),
        });
      }
    }

    pageToken = result.pageToken;
  } while (pageToken);

  return { authOnlyContractorUsers, hits: authHits };
}

async function inspectStorage(contractorIds: Set<string>) {
  try {
    const [files] = await (await getBucket()).getFiles({ autoPaginate: true, maxResults: 5000 });
    const folderIds = new Set<string>();
    const hits: Array<{ path: string; matchedTerms: string[] }> = [];

    for (const file of files) {
      const name = file.name;
      const segments = name.split("/").filter(Boolean);
      const folderId = segments[0] === "contractors" ? segments[1] : segments[0];
      if (folderId) {
        folderIds.add(folderId);
      }

      const matchedTerms = matchesSearchTerms(name);
      if (matchedTerms.length) {
        hits.push({ path: name, matchedTerms });
      }
    }

    return {
      bucket: (await getBucketName()) ?? "default",
      scannedObjects: files.length,
      storageOnlyContractorFolders: [...folderIds].filter((id) => !contractorIds.has(id) && normalize(id).includes("contractor")),
      hits,
    };
  } catch (error) {
    return {
      bucket: (await getBucketName()) ?? "default",
      error: error instanceof Error ? error.message : "Unable to inspect storage",
      scannedObjects: 0,
      storageOnlyContractorFolders: [],
      hits: [],
    };
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const reports = await Promise.all(COLLECTIONS.map((collection) => inspectCollection(collection)));
  const contractors = reports.find((report) => report.collection === "contractors");
  const contractorIds = new Set<string>();

  if (contractors) {
    const snapshot = await (await getDb()).collection("contractors").limit(1000).get();
    for (const doc of snapshot.docs) {
      contractorIds.add(doc.id);
      const contractorId = asString(doc.data().contractorId);
      if (contractorId) {
        contractorIds.add(contractorId);
      }
    }
  }

  const [auth, storage] = await Promise.all([inspectAuthUsers(contractorIds), inspectStorage(contractorIds)]);
  const discoveredLegacyCollections = reports
    .filter((report) => report.collection !== "contractors" && (report.contractorLikeCount > 0 || report.hits.length > 0))
    .map((report) => report.collection);

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      nextPublicFirebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      googleApplicationCredentialsConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      firebaseStorageBucketConfigured: Boolean(process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
      storageBucket: (await getBucketName()) ?? "default",
    },
    summary: {
      currentLiveContractorCount: contractors?.count ?? 0,
      legacyContractorCount: reports
        .filter((reportItem) => reportItem.collection !== "contractors")
        .reduce((sum, reportItem) => sum + reportItem.contractorLikeCount, 0),
      contractorsWithoutWorkspaceIds: contractors?.withoutWorkspaceId ?? 0,
      duplicateContractorBusinessNames: contractors?.duplicateBusinessNames ?? [],
      authOnlyContractorUsers: auth.authOnlyContractorUsers,
      discoveredLegacyCollections,
    },
    mackayAndDaughters: reports.flatMap((reportItem) =>
      reportItem.hits.filter((hit) => hit.matchedTerms.some((term) => normalize(term).includes("mackay"))),
    ),
    feMillerPools: reports.flatMap((reportItem) =>
      reportItem.hits.filter((hit) => normalize(hit.matchedTerms.join(" ")).includes("miller")),
    ),
    collections: reports,
    auth,
    storage,
    notes: [
      "Read-only diagnostic. No contractor, user, storage, or migration writes were performed.",
      "Collection reads are capped at 1000 documents per top-level collection.",
      "Email values from Firebase Auth are masked in the report.",
    ],
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

