import "server-only";

import { unstable_cache } from "next/cache";

import { discoverInventoryEndpoints, parseInventoryJson, parseJsonLdInventory, parseStaticHtmlInventory } from "./roarInventoryParser";
import type { RoarInventoryMetrics, RoarInventoryResponse, RoarInventorySourceType, RoarInventoryVehicle } from "@/types/roarInventory";

const SOURCE_URL = "https://roarcarssa.com/inventory.html";
const MAX_RESPONSE_BYTES = 5_000_000;
const USER_AGENT = "TorqueEmpire-RoarInventory/1.0 (+https://ai-pro-crm-clean.vercel.app)";

async function fetchSource(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Roar Cars source returned ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_RESPONSE_BYTES) throw new Error("Roar Cars source response exceeded size limit");
  return response;
}

function calculateMetrics(vehicles: RoarInventoryVehicle[]): RoarInventoryMetrics {
  const active = vehicles.filter((vehicle) => !/sold|inactive/i.test(vehicle.status));
  const priced = active.filter((vehicle) => typeof vehicle.price === "number" && vehicle.price > 0);
  const currentYear = new Date().getFullYear();
  const modelAges = active.flatMap((vehicle) => (vehicle.year ? [Math.max(0, currentYear - vehicle.year)] : []));
  const inventoryValue = priced.reduce((total, vehicle) => total + Number(vehicle.price), 0);

  return {
    activeVehicles: active.length,
    inventoryValue,
    averageVehiclePrice: priced.length ? Math.round(inventoryValue / priced.length) : 0,
    averageModelAge: modelAges.length ? Number((modelAges.reduce((total, age) => total + age, 0) / modelAges.length).toFixed(1)) : null,
    vehiclesAddedThisMonth: null,
  };
}

async function loadRoarInventory(): Promise<RoarInventoryResponse> {
  const syncedAt = new Date().toISOString();
  const pageResponse = await fetchSource(SOURCE_URL);
  const html = await pageResponse.text();
  if (Buffer.byteLength(html, "utf8") > MAX_RESPONSE_BYTES) throw new Error("Roar Cars source response exceeded size limit");

  let vehicles: RoarInventoryVehicle[] = [];
  let sourceType: RoarInventorySourceType = "unavailable";
  let resolvedUrl = pageResponse.url || SOURCE_URL;

  for (const endpoint of discoverInventoryEndpoints(html, resolvedUrl)) {
    try {
      const apiResponse = await fetchSource(endpoint);
      const contentType = apiResponse.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) continue;
      vehicles = parseInventoryJson(await apiResponse.json(), syncedAt, endpoint);
      if (vehicles.length) {
        sourceType = "api";
        resolvedUrl = endpoint;
        break;
      }
    } catch (error) {
      console.warn("[roar-inventory] candidate endpoint rejected", { endpoint, error });
    }
  }

  if (!vehicles.length) {
    vehicles = parseJsonLdInventory(html, syncedAt, resolvedUrl);
    if (vehicles.length) sourceType = "json-ld";
  }
  if (!vehicles.length) {
    vehicles = parseStaticHtmlInventory(html, syncedAt, resolvedUrl);
    if (vehicles.length) sourceType = "static-html";
  }
  if (!vehicles.length) throw new Error("No supported vehicle inventory data was found on the Roar Cars source page");

  return {
    vehicles,
    metrics: calculateMetrics(vehicles),
    status: "LIVE",
    syncedAt,
    sourceUrl: SOURCE_URL,
    itemCount: vehicles.length,
    source: { type: sourceType, url: resolvedUrl, lastSyncedAt: syncedAt },
  };
}

export const getRoarInventory = unstable_cache(loadRoarInventory, ["roar-cars-inventory-v1"], {
  revalidate: 900,
  tags: ["roar-cars-inventory"],
});

export { SOURCE_URL as ROAR_INVENTORY_SOURCE_URL };
