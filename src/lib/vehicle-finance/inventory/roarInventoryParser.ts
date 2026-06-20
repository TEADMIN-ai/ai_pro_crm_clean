import type { RoarInventoryVehicle } from "@/types/roarInventory";

const ROAR_ORIGIN = "https://roarcarssa.com";
const KNOWN_TRANSMISSIONS = ["automatic", "manual", "cvt", "dct", "tiptronic"];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstString(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return cleanText(value);
    if (isRecord(value) && typeof value.url === "string") return cleanText(value.url);
  }
  return "";
}

function firstNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    if (isRecord(value)) {
      const nested = firstNumber(value, ["value", "price", "amount"]);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function safeUrl(value: string, baseUrl = ROAR_ORIGIN): string | null {
  if (!value || value.startsWith("data:")) return null;
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sourceHost(baseUrl = ROAR_ORIGIN): string {
  try {
    return new URL(baseUrl).hostname.replace(/^www\./i, "") || "roarcarssa.com";
  } catch {
    return "roarcarssa.com";
  }
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `roar-${(hash >>> 0).toString(36)}`;
}

function inferMakeAndModel(title: string, record: UnknownRecord): { make: string; model: string } {
  const make = firstString(record, ["make", "brand", "manufacturer"]);
  const model = firstString(record, ["model", "vehicleModel", "variant"]);
  if (make || model) return { make, model };

  const withoutYear = title.replace(/\b(?:19|20)\d{2}\b/g, "").trim();
  const [inferredMake = "", ...modelParts] = withoutYear.split(/\s+/);
  return { make: inferredMake, model: modelParts.join(" ") };
}

function normalizeRecord(record: UnknownRecord, syncedAt: string, baseUrl = ROAR_ORIGIN): RoarInventoryVehicle | null {
  const rawTitle = firstString(record, ["title", "name", "vehicleName", "heading", "description"]);
  const year = firstNumber(record, ["year", "yearModel", "modelYear"]);
  const title = rawTitle || [year, firstString(record, ["make"]), firstString(record, ["model"])].filter(Boolean).join(" ");
  if (!title) return null;

  const listingUrl = safeUrl(firstString(record, ["listingUrl", "url", "href", "link", "productUrl"]), baseUrl) ?? baseUrl;
  const imageValue = record.image;
  const imageFromArray = Array.isArray(imageValue) ? imageValue.find((item) => typeof item === "string") : null;
  const imageUrl = safeUrl(
    firstString(record, ["imageUrl", "image_url", "thumbnail", "photo", "src"]) ||
      (typeof imageFromArray === "string" ? imageFromArray : "") ||
      (typeof imageValue === "string" ? imageValue : ""),
    baseUrl,
  );
  const { make, model } = inferMakeAndModel(title, record);
  const transmission = firstString(record, ["transmission", "gearbox", "transmissionType"]);
  const rawId = firstString(record, ["id", "vehicleId", "stockNumber", "sku", "vin"]);

  return {
    id: rawId || stableId(`${listingUrl}|${title}`),
    title,
    make,
    model,
    year: year && year >= 1900 && year <= new Date().getFullYear() + 1 ? Math.round(year) : null,
    price: firstNumber(record, ["price", "vehiclePrice", "salePrice", "offers"]),
    priceNumber: firstNumber(record, ["price", "vehiclePrice", "salePrice", "offers"]),
    mileage: firstNumber(record, ["mileage", "odometer", "kilometres", "kilometers", "km"]),
    mileageNumber: firstNumber(record, ["mileage", "odometer", "kilometres", "kilometers", "km"]),
    transmission: transmission || null,
    fuelType: firstString(record, ["fuelType", "fuel", "fueltype"]) || null,
    bodyType: firstString(record, ["bodyType", "body", "vehicleType"]) || null,
    imageUrl,
    listingUrl,
    status: firstString(record, ["status", "availability", "stockStatus"]) || "ACTIVE",
    source: sourceHost(baseUrl),
    lastSyncedAt: syncedAt,
  };
}

function collectRecordArrays(value: unknown, depth = 0): UnknownRecord[][] {
  if (depth > 6) return [];
  if (Array.isArray(value)) {
    const records = value.filter(isRecord);
    return records.length ? [records] : value.flatMap((item) => collectRecordArrays(item, depth + 1));
  }
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap((item) => collectRecordArrays(item, depth + 1));
}

function dedupeVehicles(vehicles: RoarInventoryVehicle[]): RoarInventoryVehicle[] {
  const seen = new Set<string>();
  return vehicles.filter((vehicle) => {
    const key = `${vehicle.listingUrl}|${vehicle.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseInventoryJson(value: unknown, syncedAt: string, baseUrl = ROAR_ORIGIN): RoarInventoryVehicle[] {
  const arrays = collectRecordArrays(value).sort((left, right) => right.length - left.length);
  for (const records of arrays) {
    const vehicles = records.map((record) => normalizeRecord(record, syncedAt, baseUrl)).filter((vehicle): vehicle is RoarInventoryVehicle => Boolean(vehicle));
    if (vehicles.length) return dedupeVehicles(vehicles);
  }
  if (isRecord(value)) {
    const vehicle = normalizeRecord(value, syncedAt, baseUrl);
    return vehicle ? [vehicle] : [];
  }
  return [];
}

export function parseJsonLdInventory(html: string, syncedAt: string, baseUrl = ROAR_ORIGIN): RoarInventoryVehicle[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const vehicles = parseInventoryJson(JSON.parse(script[1]), syncedAt, baseUrl);
      if (vehicles.length) return vehicles;
    } catch {
      // Ignore malformed publisher metadata and continue to other source types.
    }
  }
  return [];
}

function attribute(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}

function textMatch(block: string, expression: RegExp): string {
  return cleanText(block.match(expression)?.[1] ?? "");
}

export function parseStaticHtmlInventory(html: string, syncedAt: string, baseUrl = ROAR_ORIGIN): RoarInventoryVehicle[] {
  const blocks = [...html.matchAll(/<(?:article|li|div)\b[^>]*class=["'][^"']*(?:vehicle|inventory|car-card|stock-card)[^"']*["'][^>]*>([\s\S]*?)(?=<\/(?:article|li|div)>)/gi)].map((match) => match[0]);
  const vehicles = blocks.flatMap((block) => {
    const heading = textMatch(block, /<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/i) || cleanText(attribute(block, "title"));
    const imageTag = block.match(/<img\b[^>]*>/i)?.[0] ?? "";
    const anchorTag = block.match(/<a\b[^>]*>/i)?.[0] ?? "";
    const text = cleanText(block);
    const year = text.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? "";
    const price = text.match(/\bR\s?([0-9][0-9\s,.]*)/i)?.[1] ?? "";
    const mileage = text.match(/([0-9][0-9\s,.]*)\s*(?:km|kilometres?)/i)?.[1] ?? "";
    const transmission = KNOWN_TRANSMISSIONS.find((item) => text.toLowerCase().includes(item)) ?? "";
    const record: UnknownRecord = {
      title: heading || text.slice(0, 140),
      year,
      price,
      mileage,
      transmission,
      imageUrl: attribute(imageTag, "data-src") || attribute(imageTag, "src"),
      listingUrl: attribute(anchorTag, "href"),
      id: attribute(block, "data-id") || attribute(block, "data-stock-number"),
    };
    const vehicle = normalizeRecord(record, syncedAt, baseUrl);
    return vehicle ? [vehicle] : [];
  });
  return dedupeVehicles(vehicles);
}

export function discoverInventoryEndpoints(html: string, pageUrl: string): string[] {
  const candidates = [
    ...html.matchAll(/(?:fetch|axios\.get|\$\.getJSON)\s*\(\s*["']([^"']+)["']/gi),
    ...html.matchAll(/["']([^"']*(?:api|inventory|vehicles|stock)[^"']*\.json(?:\?[^"']*)?)["']/gi),
  ];
  const page = new URL(pageUrl);
  const urls = candidates.flatMap((match) => {
    const url = safeUrl(match[1], pageUrl);
    if (!url) return [];
    const candidate = new URL(url);
    return candidate.origin === page.origin && candidate.toString() !== page.toString() ? [candidate.toString()] : [];
  });
  return [...new Set(urls)].slice(0, 5);
}
