import {
  discoverInventoryEndpoints,
  parseInventoryJson,
  parseJsonLdInventory,
  parseStaticHtmlInventory,
} from "@/lib/vehicle-finance/inventory/roarInventoryParser";

const SYNCED_AT = "2026-06-20T12:00:00.000Z";

describe("Roar inventory parser", () => {
  it("normalizes a JSON API payload", () => {
    const vehicles = parseInventoryJson(
      {
        inventory: [
          {
            id: "stock-1",
            title: "2022 BMW 320i M Sport",
            make: "BMW",
            model: "320i M Sport",
            year: 2022,
            price: "R 529 900",
            mileage: "41 000 km",
            transmission: "Automatic",
            image: "/images/bmw.jpg",
            url: "/vehicle/bmw-320i.html",
          },
        ],
      },
      SYNCED_AT,
      "https://roarcarssa.com/inventory.html",
    );

    expect(vehicles).toEqual([
      expect.objectContaining({
        id: "stock-1",
        make: "BMW",
        year: 2022,
        price: 529900,
        mileage: 41000,
        listingUrl: "https://roarcarssa.com/vehicle/bmw-320i.html",
        lastSyncedAt: SYNCED_AT,
      }),
    ]);
  });

  it("reads vehicle JSON-LD", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      itemListElement: [
        {
          name: "2021 Volkswagen Polo GTI",
          model: "Polo GTI",
          brand: "Volkswagen",
          vehicleModelDate: "2021",
          mileageFromOdometer: { value: "65000" },
          offers: { price: "419900" },
          url: "/vehicle/polo-gti",
          image: "/images/polo.jpg",
        },
      ],
    })}</script>`;

    const vehicles = parseJsonLdInventory(html, SYNCED_AT, "https://roarcarssa.com/inventory.html");
    expect(vehicles[0]).toEqual(expect.objectContaining({ title: "2021 Volkswagen Polo GTI", price: 419900 }));
  });

  it("parses static inventory card markup", () => {
    const html = `
      <article class="vehicle-card" data-id="stock-2">
        <a href="/vehicle/ford-ranger"><img data-src="/images/ranger.jpg" /></a>
        <h3>2020 Ford Ranger 2.0 Bi-Turbo</h3>
        <p>R 549 900</p><p>89 000 km</p><p>Automatic</p>
      </article>`;

    const vehicles = parseStaticHtmlInventory(html, SYNCED_AT, "https://roarcarssa.com/inventory.html");
    expect(vehicles[0]).toEqual(expect.objectContaining({ id: "stock-2", year: 2020, price: 549900, mileage: 89000 }));
  });

  it("only discovers same-origin candidate endpoints", () => {
    const html = `fetch('/api/inventory.json'); fetch('https://evil.example/vehicles.json')`;
    expect(discoverInventoryEndpoints(html, "https://roarcarssa.com/inventory.html")).toEqual([
      "https://roarcarssa.com/api/inventory.json",
    ]);
  });
});
