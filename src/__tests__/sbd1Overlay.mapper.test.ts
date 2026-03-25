import { buildSBD1OverlayPlan } from "@/lib/pdf/sbd1-overlay/mapper";

describe("buildSBD1OverlayPlan", () => {
  test("maps sanitized overlay input into deterministic drawing instructions", () => {
    const plan = buildSBD1OverlayPlan({
      companyName: "  Example Company Name That Is Longer Than Forty Characters  ",
      companyAddressLine1: "  10 Main Road  ",
      companyAddressLine2: "  Unit 4  ",
      contactNumber: " 011 123 4567 ",
      email: " info@example.com ",
      vatNumber: " 1234567890 ",
      bbbee: "YES",
      generatedAt: new Date("2026-03-25T00:00:00.000Z"),
    });

    expect(plan.textInstructions).toHaveLength(7);
    expect(plan.textInstructions[0]).toMatchObject({
      field: "companyName",
      text: "Example Company Name That Is Longer Than",
      x: 148,
      y: 431.2,
      size: 9,
      maxWidth: 415.5,
    });
    expect(plan.textInstructions[1].text).toBe("10 Main Road");
    expect(plan.textInstructions[2].text).toBe("Unit 4");
    expect(plan.textInstructions[3]).toMatchObject({
      field: "contactNumberCode",
      text: "011",
      x: 158,
      y: 380.7,
    });
    expect(plan.textInstructions[4]).toMatchObject({
      field: "contactNumberValue",
      text: "123 4567",
      x: 239,
      y: 380.7,
    });
    expect(plan.checkboxInstruction).toMatchObject({
      field: "bbbee",
      mark: "X",
      x: 420,
      y: 215,
      size: 10,
    });
    expect(plan.dateInstruction.field).toBe("date");
    expect(plan.dateInstruction.text).toBe("2026/03/25");
    expect(plan.dateInstruction.pageIndex).toBe(-1);
  });

  test("falls back to overlay defaults and marks NO when B-BBEE is not affirmative", () => {
    const plan = buildSBD1OverlayPlan({
      companyName: undefined,
      bbbee: "no",
      generatedAt: new Date("2026-03-25T00:00:00.000Z"),
    });

    expect(plan.textInstructions[0].text).toBe("Torque Empire Pty Ltd");
    expect(plan.textInstructions[1].text).toBe("33 Banberry Drive Eldorado Park Ext 3");
    expect(plan.textInstructions[3].text).toBe("069");
    expect(plan.textInstructions[4].text).toBe("5024909");
    expect(plan.checkboxInstruction.x).toBe(465);
  });
});
