import {
  getSubmissionProfilePackSet,
  submissionPackKeys,
  submissionProfileKeys,
} from "@/lib/submission-profiles";
import type { SubmissionPackKey, SubmissionProfileKey } from "@/lib/submission-profiles";

function expectUniquePackKeys(profileKey: SubmissionProfileKey, packKeys: SubmissionPackKey[]): void {
  expect(new Set(packKeys).size).toBe(packKeys.length);
  expect(packKeys).toEqual(Array.from(new Set(packKeys)));
}

describe("submission profile pack generation", () => {
  it("generates unique pack keys for every profile pack set", () => {
    for (const profileKey of submissionProfileKeys) {
      const packKeys = getSubmissionProfilePackSet(profileKey).packs.map((pack) => pack.key);

      expectUniquePackKeys(profileKey, packKeys);
    }
  });

  it("preserves deterministic pack ordering by profile class", () => {
    const expectedOrder: Record<SubmissionProfileKey, SubmissionPackKey[]> = {
      government: ["government_submission", "internal_operations_pack"],
      municipal: ["government_submission", "internal_operations_pack"],
      private: ["contractor_review_pack", "internal_operations_pack"],
      corporate: ["contractor_review_pack", "internal_operations_pack"],
      construction: ["contractor_review_pack", "internal_operations_pack"],
    };

    for (const profileKey of submissionProfileKeys) {
      expect(getSubmissionProfilePackSet(profileKey).packs.map((pack) => pack.key)).toEqual(expectedOrder[profileKey]);
    }
  });

  it("builds government-style packs from only the selected public-sector profile", () => {
    const governmentPack = getSubmissionProfilePackSet("government").packs.find((pack) => pack.key === "government_submission");
    const municipalPack = getSubmissionProfilePackSet("municipal").packs.find((pack) => pack.key === "government_submission");

    expect(governmentPack?.sections[0]?.items).toContain("CIPC Registration");
    expect(governmentPack?.sections[0]?.items).not.toContain("CIDB Registration");
    expect(municipalPack?.sections[0]?.items).toContain("CIDB Registration");
    expect(municipalPack?.sections[0]?.items).not.toContain("CIPC Registration");
  });

  it("keeps the exported pack key catalogue unique", () => {
    expect(submissionPackKeys).toEqual(["government_submission", "contractor_review_pack", "internal_operations_pack"]);
    expect(new Set(submissionPackKeys).size).toBe(submissionPackKeys.length);
  });
});
