import {
  normalizeRoarInventoryImageUrl,
  parseRoarInventoryMileage,
  parseRoarInventoryPrice,
  parseRoarInventoryTitle,
} from "@/lib/vehicle-finance/roarInventory";

describe("Roar inventory utilities", () => {
  it("parses price strings to numbers", () => {
    expect(parseRoarInventoryPrice("R889 950")).toBe(889950);
  });

  it("parses mileage strings to numbers", () => {
    expect(parseRoarInventoryMileage("68 898km")).toBe(68898);
  });

  it("normalizes relative image URLs", () => {
    expect(normalizeRoarInventoryImageUrl("/images/bmw.jpg", "https://roarcarssa.com/inventory.html")).toBe(
      "https://roarcarssa.com/images/bmw.jpg",
    );
  });

  it("infers title, make, model, and year from the listing title", () => {
    expect(parseRoarInventoryTitle("Volkswagen Tiguan Allspace 2.0 TSI 4 Motion Comfortline R-Line 2019")).toEqual(
      expect.objectContaining({
        title: "Volkswagen Tiguan Allspace 2.0 TSI 4 Motion Comfortline R-Line 2019",
        make: "Volkswagen",
        model: "Tiguan Allspace 2.0 TSI 4 Motion Comfortline R-Line",
        year: 2019,
      }),
    );
  });
});
