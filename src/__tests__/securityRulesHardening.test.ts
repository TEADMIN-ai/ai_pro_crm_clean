import fs from "node:fs";
import path from "node:path";

function readWorkspaceFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("security hardening regressions", () => {
  test("Firestore rules prevent client-side role and contractor identity changes", () => {
    const rules = readWorkspaceFile("firestore.rules");

    expect(rules).toContain("function protectedUserFields()");
    expect(rules).toContain("\"role\"");
    expect(rules).toContain("\"contractorId\"");
    expect(rules).toContain("doesNotSetProtectedUserFields()");
    expect(rules).toContain("doesNotModifyProtectedUserFields()");
    expect(rules).toContain("allow update: if isSignedIn()");
    expect(rules).toContain("&& doesNotModifyProtectedUserFields()");
  });

  test("contractor root records are server-owned in Firestore rules", () => {
    const rules = readWorkspaceFile("firestore.rules");

    expect(rules).toContain("match /contractors/{docId}");
    expect(rules).toContain("allow write: if false;");
  });

  test("top-level document reads are scoped by role or contractor ownership", () => {
    const rules = readWorkspaceFile("firestore.rules");

    expect(rules).toContain("function canAccessDocument(data)");
    expect(rules).toContain("allow read: if isSignedIn() && canAccessDocument(resource.data);");
    expect(rules).not.toContain("allow read: if isSignedIn();");
  });

  test("Storage rules deny direct protected document SDK access", () => {
    const rules = readWorkspaceFile("storage.rules");

    expect(rules).toContain("match /contractors/{contractorId}/{allPaths=**}");
    expect(rules).toContain("match /tenders/{ownerUid}/{allPaths=**}");
    expect(rules).toContain("match /{allPaths=**}");
    expect(rules).toContain("allow read, write: if false;");
    expect(rules).not.toContain("allow read, write: if request.auth != null");
    expect(rules).not.toContain("match /{allPaths=**} {\n      allow read, write: if isPrivileged();");
  });

  test("source does not create 10-year signed URLs", () => {
    const sourceFiles = [
      "src/app/api/documents/upload/route.ts",
      "src/app/api/deals/[dealId]/documents/route.ts",
      "src/app/api/tender-pack/test-fill/route.ts",
    ];

    for (const file of sourceFiles) {
      const source = readWorkspaceFile(file);
      expect(source).not.toContain("365 * 10");
    }
  });
});
