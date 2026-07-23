import { readFileSync } from "fs";
import path from "path";

describe("ContractorsWorkspace reference surface", () => {
  const source = readFileSync(path.join(process.cwd(), "src/components/contractors/ContractorsWorkspace.tsx"), "utf8");

  it("labels the business-facing column as Contractor Reference", () => {
    expect(source).toContain("<th>Contractor Reference</th>");
    expect(source).not.toContain("<th>Contractor ID</th>");
  });

  it("does not expose the internal contractor route identifier as normal table text or href", () => {
    expect(source).toContain("getBusinessFacingContractorReference(contractor)");
    expect(source).not.toContain('<td className="font-mono text-xs">{contractorId}</td>');
    expect(source).not.toContain('href={`/dashboard/contractors/${encodeURIComponent(contractorId)}`}');
  });

  it("keeps CIPC and CSD identifiers separate from the contractor reference", () => {
    expect(source).toContain("<th>CIPC Registration Number</th>");
    expect(source).toContain("<th>CSD Supplier Number</th>");
    expect(source).toContain("getCipcRegistrationNumber(contractor)");
    expect(source).toContain("getCsdSupplierNumber(contractor)");
  });
});

