import { readFileSync } from "node:fs";
import path from "node:path";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("contractor lifecycle authority boundary", () => {
  test("archive and restore routes resolve the actor server-side and reject missing authority inputs", () => {
    const archive = read("src/app/api/contractors/[contractorId]/archive/route.ts");
    const restore = read("src/app/api/contractors/[contractorId]/restore/route.ts");
    expect(archive).toContain("requireAuthorizedUser(request)");
    expect(archive).toContain('user.role !== "admin"');
    expect(archive).toContain("Archive reason is required");
    expect(restore).toContain("requireAuthorizedUser(request)");
    expect(archive).not.toMatch(/body\.(uid|email|role|workspace|permissions|actor)/);
    expect(restore).not.toMatch(/body\.(uid|email|role|workspace|permissions|actor)/);
  });

  test("archive state is server-owned, auditable and fail-closed for active workflows", () => {
    const service = read("src/server/services/contractorService.ts");
    const authority = read("src/server/services/contractorAssignmentAuthorityService.ts");
    const visibility = read("src/lib/contractors/contractorVisibility.ts");
    expect(service).toContain('status: "archived"');
    expect(service).toContain("archivedByUid");
    expect(service).toContain("CONTRACTOR_ARCHIVED");
    expect(service).toContain("CONTRACTOR_RESTORED");
    expect(authority).toContain("isArchivedContractor");
    expect(authority).toContain("Contractor is archived");
    expect(visibility).toContain("includeArchived");
  });

  test("lifecycle controls remain admin-only in the profile UI", () => {
    const ui = read("src/components/contractors/ContractorLifecycleControls.tsx");
    expect(ui).toContain('if (role !== "admin") return null');
    expect(ui).toContain("dependencySummary");
    expect(ui).toContain("replacementContractorId");
    expect(ui).toContain("Historical records and documents remain readable");
  });
});
