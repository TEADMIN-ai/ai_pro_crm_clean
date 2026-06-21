import "server-only";

import { discoverInventoryEndpoints, parseInventoryJson, parseJsonLdInventory, parseStaticHtmlInventory } from "./inventory/roarInventoryParser";
import type { RoarInventoryMetrics, RoarInventoryResponse, RoarInventorySourceType, RoarInventoryVehicle } from "@/types/roarInventory";

export type VehicleInventoryItem = RoarInventoryVehicle;

const SOURCE_URL = "https://roarcarssa.com/inventory.html";
const MAX_RESPONSE_BYTES = 5_000_000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_ATTEMPTS = 3;
const USER_AGENT = "TorqueEmpire-RoarInventory/1.0 (+https://ai-pro-crm-clean.vercel.app)";
const EMPTY_IMAGE_URL = "/images/roar-cars-placeholder.svg";

type InventoryCacheEntry = {
  response: RoarInventoryResponse;
  cachedAt: number;
};

let inventoryCache: InventoryCacheEntry | null = null;

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

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function parseRoarInventoryPrice(value: unknown): number | null {
  return parseNumericValue(value);
}

export function parseRoarInventoryMileage(value: unknown): number | null {
  return parseNumericValue(value);
}

export function normalizeRoarInventoryImageUrl(value: unknown, baseUrl = SOURCE_URL): string | null {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.startsWith("data:")) return null;

  try {
    const url = new URL(candidate, baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeRosterSource(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, "") || "roarcarssa.com";
  } catch {
    return "roarcarssa.com";
  }
}

function inferTitleDetails(title: string): { title: string; make: string; model: string; year: number | null } {
  const trimmed = cleanText(title);
  const yearMatch = trimmed.match(/\b((?:19|20)\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const withoutYear = trimmed.replace(/\b(?:19|20)\d{2}\b/g, "").replace(/\s+/g, " ").trim();
  const [make = "", ...modelParts] = withoutYear.split(/\s+/);
  return {
    title: trimmed,
    make,
    model: modelParts.join(" "),
    year: year && year >= 1900 && year <= new Date().getFullYear() + 1 ? year : null,
  };
}

export function parseRoarInventoryTitle(title: string): { title: string; make: string; model: string; year: number | null } {
  return inferTitleDetails(title);
}

function normalizeVehicle(vehicle: RoarInventoryVehicle, sourceUrl: string): RoarInventoryVehicle {
  const titleDetails = inferTitleDetails(vehicle.title);
  const priceNumber = parseRoarInventoryPrice(vehicle.price ?? vehicle.priceNumber);
  const mileageNumber = parseRoarInventoryMileage(vehicle.mileage ?? vehicle.mileageNumber);
  const listingUrl = normalizeRoarInventoryImageUrl(vehicle.listingUrl, sourceUrl) ?? vehicle.listingUrl;
  const imageUrl = normalizeRoarInventoryImageUrl(vehicle.imageUrl, sourceUrl) ?? EMPTY_IMAGE_URL;

  return {
    ...vehicle,
    title: titleDetails.title || vehicle.title,
    make: vehicle.make || titleDetails.make,
    model: vehicle.model || titleDetails.model,
    year: vehicle.year ?? titleDetails.year,
    price: priceNumber,
    priceNumber,
    mileage: mileageNumber,
    mileageNumber,
    transmission: vehicle.transmission?.trim() || null,
    fuelType: vehicle.fuelType?.trim() || null,
    bodyType: vehicle.bodyType?.trim() || null,
    imageUrl,
    listingUrl,
    status: vehicle.status?.trim() || "ACTIVE",
    source: vehicle.source || normalizeRosterSource(sourceUrl),
    lastSyncedAt: vehicle.lastSyncedAt,
  };
}

function calculateMetrics(vehicles: RoarInventoryVehicle[]): RoarInventoryMetrics {
  const active = vehicles.filter((vehicle) => !/sold|inactive|reserved/i.test(vehicle.status));
  const priced = active.filter((vehicle) => typeof vehicle.priceNumber === "number" && vehicle.priceNumber > 0);
  const currentYear = new Date().getFullYear();
  const modelAges = active.flatMap((vehicle) => (vehicle.year ? [Math.max(0, currentYear - vehicle.year)] : []));
  const inventoryValue = priced.reduce((total, vehicle) => total + Number(vehicle.priceNumber ?? 0), 0);

  return {
    activeVehicles: active.length,
    inventoryValue,
    averageVehiclePrice: priced.length ? Math.round(inventoryValue / priced.length) : 0,
    averageModelAge: modelAges.length ? Number((modelAges.reduce((total, age) => total + age, 0) / modelAges.length).toFixed(1)) : null,
    vehiclesAddedThisMonth: null,
  };
}

function normalizeVehicleList(vehicles: RoarInventoryVehicle[], sourceUrl: string, syncedAt: string): RoarInventoryVehicle[] {
  return vehicles.map((vehicle) =>
    normalizeVehicle(
      {
        ...vehicle,
        lastSyncedAt: syncedAt,
        source: vehicle.source || normalizeRosterSource(sourceUrl),
      },
      sourceUrl,
    ),
  );
}

function createResponse(args: {
  vehicles: RoarInventoryVehicle[];
  sourceType: RoarInventorySourceType;
  sourceUrl: string;
  pageUrl: string;
  syncedAt: string;
  status: RoarInventoryResponse["status"];
  warning?: string;
}): RoarInventoryResponse {
  const vehicles = normalizeVehicleList(args.vehicles, args.pageUrl, args.syncedAt);
  return {
    vehicles,
    metrics: calculateMetrics(vehicles),
    status: args.status,
    syncedAt: args.syncedAt,
    sourceUrl: args.sourceUrl,
    itemCount: vehicles.length,
    source: {
      type: args.sourceType,
      url: args.pageUrl,
      lastSyncedAt: args.syncedAt,
    },
    warning: args.warning,
  };
}

export function isRetriableRoarInventoryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelay(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250 * 3 ** attempt));
}

async function fetchSource(url: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "User-Agent": USER_AGENT,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });

      if (!response.ok) {
        const error = new Error(`Roar Cars source returned ${response.status}`);
        if (!isRetriableRoarInventoryStatus(response.status)) throw error;
        lastError = error;
      } else {
        const length = Number(response.headers.get("content-length") ?? 0);
        if (length > MAX_RESPONSE_BYTES) {
          throw new Error("Roar Cars source response exceeded size limit");
        }
        return response;
      }
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /exceeded size limit|returned 4(?!08|25|29)\d/.test(error.message)) {
        throw error;
      }
    }

    if (attempt < FETCH_ATTEMPTS - 1) await retryDelay(attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Roar Cars source request failed");
}

export async function fetchLiveRoarInventory(): Promise<RoarInventoryResponse> {
  const syncedAt = new Date().toISOString();
  const pageResponse = await fetchSource(SOURCE_URL);
  const html = await pageResponse.text();
  if (Buffer.byteLength(html, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("Roar Cars source response exceeded size limit");
  }

  const pageUrl = pageResponse.url || SOURCE_URL;
  const sourceUrl = SOURCE_URL;
  let sourceType: RoarInventorySourceType = "unavailable";
  let vehicles: RoarInventoryVehicle[] = [];

  const endpointResults = await Promise.all(
    discoverInventoryEndpoints(html, pageUrl).map(async (endpoint) => {
      try {
        const apiResponse = await fetchSource(endpoint);
        const contentType = apiResponse.headers.get("content-type") ?? "";
        if (!contentType.includes("json")) return null;
        const endpointVehicles = parseInventoryJson(await apiResponse.json(), syncedAt, endpoint) as RoarInventoryVehicle[];
        return endpointVehicles.length ? { endpoint, vehicles: endpointVehicles } : null;
      } catch (error) {
        console.warn("[roar-inventory] candidate endpoint rejected", { endpoint, error });
        return null;
      }
    }),
  );
  const apiInventory = endpointResults.find((result) => result !== null);
  if (apiInventory) {
    sourceType = "api";
    return createResponse({
      vehicles: apiInventory.vehicles,
      sourceType,
      sourceUrl,
      pageUrl: apiInventory.endpoint,
      syncedAt,
      status: "LIVE",
    });
  }

  vehicles = parseJsonLdInventory(html, syncedAt, pageUrl) as RoarInventoryVehicle[];
  if (vehicles.length) {
    sourceType = "json-ld";
    return createResponse({
      vehicles,
      sourceType,
      sourceUrl,
      pageUrl,
      syncedAt,
      status: "LIVE",
    });
  }

  vehicles = parseStaticHtmlInventory(html, syncedAt, pageUrl) as RoarInventoryVehicle[];
  if (vehicles.length) {
    sourceType = "static-html";
    return createResponse({
      vehicles,
      sourceType,
      sourceUrl,
      pageUrl,
      syncedAt,
      status: "LIVE",
    });
  }

  throw new Error("No supported vehicle inventory data was found on the Roar Cars source page");
}

function cloneCachedResponse(response: RoarInventoryResponse, status: RoarInventoryResponse["status"], warning?: string): RoarInventoryResponse {
  return {
    ...response,
    status,
    warning,
    source: {
      ...response.source,
      type: "cached",
    },
  };
}

function createUnavailableResponse(warning: string): RoarInventoryResponse {
  const syncedAt = new Date().toISOString();
  return {
    vehicles: [],
    metrics: {
      activeVehicles: 0,
      inventoryValue: 0,
      averageVehiclePrice: 0,
      averageModelAge: null,
      vehiclesAddedThisMonth: null,
    },
    status: "UNAVAILABLE",
    syncedAt,
    sourceUrl: SOURCE_URL,
    itemCount: 0,
    source: {
      type: "unavailable",
      url: SOURCE_URL,
      lastSyncedAt: syncedAt,
    },
    warning,
  };
}

export async function getRoarInventory(): Promise<RoarInventoryResponse> {
  const now = Date.now();
  if (inventoryCache && now - inventoryCache.cachedAt < CACHE_TTL_MS) {
    return cloneCachedResponse(inventoryCache.response, "CACHED");
  }

  try {
    const liveResponse = await fetchLiveRoarInventory();
    inventoryCache = { response: liveResponse, cachedAt: now };
    return liveResponse;
  } catch (error) {
    console.warn("[roar-inventory] live sync failed", error);
    if (inventoryCache) {
      return cloneCachedResponse(
        inventoryCache.response,
        "CACHED",
        "Live inventory temporarily unavailable. Last cached inventory is shown where available.",
      );
    }

    return createUnavailableResponse("Roar inventory feed is being prepared.");
  }
}

export function peekCachedRoarInventory(): RoarInventoryResponse | null {
  return inventoryCache?.response ?? null;
}

export { SOURCE_URL as ROAR_INVENTORY_SOURCE_URL };
