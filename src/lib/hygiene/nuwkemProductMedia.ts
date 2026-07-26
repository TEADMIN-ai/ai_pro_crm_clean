export type NuwkemProductMediaItem = {
  id: string;
  category: string;
  summary: string;
  publicAssetPath: string;
  alt: string;
  sourcePage: number;
};

export const NUWKEM_PRODUCTS_URL = "https://www.nuwkem.co.za/products/";

export const NUWKEM_PRODUCT_MEDIA: NuwkemProductMediaItem[] = [
  {
    id: "sanitary-waste-bins",
    category: "Sanitary waste solution",
    summary: "Controlled sanitary waste containment options for washroom hygiene programmes.",
    publicAssetPath: "/media/partners/nuwkem/sanitary-waste-solution.webp",
    alt: "Nuwkem sanitary waste solution brochure product media",
    sourcePage: 4,
  },
  {
    id: "soap-sanitiser-dispensers",
    category: "Soap and sanitiser dispenser",
    summary: "Dispensing solutions for hand hygiene points in client facilities.",
    publicAssetPath: "/media/partners/nuwkem/soap-sanitiser-dispenser.webp",
    alt: "Nuwkem soap and sanitiser dispenser brochure product media",
    sourcePage: 4,
  },
  {
    id: "paper-dryer-solution",
    category: "Paper dispenser / hand dryer",
    summary: "Paper dispensing and hand-drying equipment for washroom service environments.",
    publicAssetPath: "/media/partners/nuwkem/paper-dryer-solution.webp",
    alt: "Nuwkem paper dispenser and hand dryer brochure product media",
    sourcePage: 4,
  },
  {
    id: "consumables-refills",
    category: "Consumables and refills",
    summary: "Refill and consumable ranges that support managed hygiene-service delivery.",
    publicAssetPath: "/media/partners/nuwkem/consumables-refills.webp",
    alt: "Nuwkem consumables and refills brochure product media",
    sourcePage: 8,
  },
  {
    id: "premium-dispenser-range",
    category: "Premium dispenser range",
    summary: "Premium and bespoke dispenser finishes for higher-specification hygiene environments.",
    publicAssetPath: "/media/partners/nuwkem/premium-dispenser-range.webp",
    alt: "Nuwkem premium dispenser range brochure product media",
    sourcePage: 6,
  },
];