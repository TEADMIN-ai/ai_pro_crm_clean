import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

function readRuleFile(fileName: string) {
  return fs.readFileSync(path.join(process.cwd(), fileName), "utf8");
}

function contractorToken(contractorId: string) {
  return {
    role: "contractor",
    contractorId,
  };
}

function staffToken() {
  return {
    role: "staff",
  };
}

function adminToken() {
  return {
    role: "admin",
    admin: true,
  };
}

function vehicleFinanceStaffToken() {
  return { role: "vehicleFinanceStaff" };
}

function putString(ref: { putString: (value: string) => { then: (onResolve: (value: unknown) => void, onReject: (reason: unknown) => void) => void } }, value: string) {
  return new Promise((resolve, reject) => {
    ref.putString(value).then(resolve, reject);
  });
}

describeWithEmulators("Firebase security rules emulator", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-torque-empire-security",
      firestore: {
        rules: readRuleFile("firestore.rules"),
      },
      storage: {
        rules: readRuleFile("storage.rules"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc("contractors/contractor-a").set({
        contractorId: "contractor-a",
        companyName: "Contractor A",
      });
      await db.doc("contractors/contractor-b").set({
        contractorId: "contractor-b",
        companyName: "Contractor B",
      });
      await db.doc("documents/doc-a").set({
        contractorId: "contractor-a",
        documentType: "cipc",
        storagePath: "contractors/contractor-a/cipc.pdf",
      });
      await db.doc("documents/doc-b").set({
        contractorId: "contractor-b",
        documentType: "cipc",
        storagePath: "contractors/contractor-b/cipc.pdf",
      });
      await db.doc("contractors/contractor-a/documents/cipc").set({
        contractorId: "contractor-a",
        documentType: "cipc",
        storagePath: "contractors/contractor-a/cipc.pdf",
      });
      await db.doc("contractors/contractor-b/documents/cipc").set({
        contractorId: "contractor-b",
        documentType: "cipc",
        storagePath: "contractors/contractor-b/cipc.pdf",
      });
      await db.doc("inventory/vehicle-a").set({
        recordType: "vehicle",
        sourceVehicleId: "stock-1",
        status: "ACTIVE",
      });
      await db.doc("inventorySyncState/roarcarssa").set({ status: "SUCCEEDED" });
      await db.doc("governanceEvents/event-a").set({ eventType: "inventory_sync_succeeded" });

      const storage = context.storage();
      await putString(storage.ref("contractors/contractor-a/cipc.pdf"), "contractor a document");
      await putString(storage.ref("contractors/contractor-b/cipc.pdf"), "contractor b document");
    });
  });

  test("Contractor A cannot access Contractor B records", async () => {
    const db = testEnv.authenticatedContext("uid-a", contractorToken("contractor-a")).firestore();

    await assertSucceeds(db.doc("contractors/contractor-a").get());
    await assertSucceeds(db.doc("documents/doc-a").get());
    await assertFails(db.doc("contractors/contractor-b").get());
    await assertFails(db.doc("contractors/contractor-b/documents/cipc").get());
    await assertFails(db.doc("documents/doc-b").get());
  });

  test("Contractor A cannot download Contractor B documents through Storage SDK", async () => {
    const storage = testEnv.authenticatedContext("uid-a", contractorToken("contractor-a")).storage();

    await assertFails(storage.ref("contractors/contractor-b/cipc.pdf").getDownloadURL());
  });

  test("Contractor A cannot upload to Contractor B storage", async () => {
    const storage = testEnv.authenticatedContext("uid-a", contractorToken("contractor-a")).storage();

    await assertFails(putString(storage.ref("contractors/contractor-b/cipc.pdf"), "replacement"));
  });

  test("Staff permissions are verified", async () => {
    const db = testEnv.authenticatedContext("staff-1", staffToken()).firestore();
    const storage = testEnv.authenticatedContext("staff-1", staffToken()).storage();

    await assertSucceeds(db.doc("contractors/contractor-b").get());
    await assertSucceeds(db.doc("documents/doc-b").get());
    await assertFails(db.doc("contractors/contractor-b").set({ contractorId: "contractor-b" }));
    await assertFails(putString(storage.ref("contractors/contractor-b/cipc.pdf"), "replacement"));
  });

  test("Admin permissions are verified", async () => {
    const db = testEnv.authenticatedContext("admin-1", adminToken()).firestore();
    const storage = testEnv.authenticatedContext("admin-1", adminToken()).storage();

    await assertSucceeds(db.doc("contractors/contractor-a").get());
    await assertSucceeds(db.doc("documents/doc-a").get());
    await assertFails(db.doc("documents/doc-a").set({ contractorId: "contractor-a" }));
    await assertFails(putString(storage.ref("contractors/contractor-a/cipc.pdf"), "replacement"));
  });

  test("Vehicle finance inventory is readable by finance staff but client writes are denied", async () => {
    const db = testEnv.authenticatedContext("finance-1", vehicleFinanceStaffToken()).firestore();

    await assertSucceeds(db.doc("inventory/vehicle-a").get());
    await assertSucceeds(db.doc("inventorySyncState/roarcarssa").get());
    await assertFails(db.doc("inventory/vehicle-a").set({ status: "SOLD" }, { merge: true }));
    await assertFails(db.doc("governanceEvents/event-a").get());
  });

  test("Contractors cannot read synchronized inventory or inventory sync state", async () => {
    const db = testEnv.authenticatedContext("uid-a", contractorToken("contractor-a")).firestore();

    await assertFails(db.doc("inventory/vehicle-a").get());
    await assertFails(db.doc("inventorySyncState/roarcarssa").get());
  });
});
