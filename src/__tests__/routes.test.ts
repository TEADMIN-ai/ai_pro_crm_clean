import { API_ROUTES } from "@/lib/routes";

describe("API_ROUTES integrity", () => {
  test("CONTRACTORS route is correct", () => {
    expect(API_ROUTES.CONTRACTORS).toBe("/api/contractors");
  });

  test("DEALS route is correct", () => {
    expect(API_ROUTES.DEALS).toBe("/api/deals");
  });

  test("TENDER_PACK_GENERATE route is correct", () => {
    expect(API_ROUTES.TENDER_PACK_GENERATE).toBe("/api/tender-pack/generate");
  });

  test("CONTRACTOR_DOCUMENTS builds correctly", () => {
    const contractorId = "test123";
    const expected = "/api/contractors/test123/documents";

    expect(API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId)).toBe(expected);
  });

  test("CONTRACTOR_DOCUMENTS never produces singular form", () => {
    const contractorId = "test123";
    const route = API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId);

    expect(route.includes("/api/contractor/")).toBe(false);
  });
});
