import "server-only";

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { persistGovernanceEvent } from "@/lib/governance/persistence";
import type { GovernanceEvent } from "@/lib/governance/types";
import { fetchLiveRoarInventory, ROAR_INVENTORY_SOURCE_URL } from "@/lib/vehicle-finance/roarInventory";
import type {
  RoarInventoryDiagnostics,
  RoarInventoryMetrics,
  RoarInventoryResponse,
  RoarInventoryVehicle,
} from "@/types/roarInventory";

const INVENTORY_COLLECTION = "inventory";
const SYNC_STATE_COLLECTION = "inventorySyncState";
const SYNC_STATE_ID = "roarcarssa";
const SOURCE_NAME = "roarcarssa.com";
const PLACEHOLDER_IMAGE_URL = "/images/roar-cars-placeholder.svg";
const LOCK_DURATION_MS = 3 * 60 * 1000;
const FRESH_INVENTORY_MS = 60 * 60 * 1000;

type InventoryImageStatus = "VALID" | "BROKEN" | "UNKNOWN" | "MISSING";

export type PersistedInventoryVehicle = RoarInventoryVehicle & {
  firestoreId: string;
  recordType: "vehicle";
  sourceVehicleId: string;
  canonicalKey: string;
  contentHash: string;
  isAvailable: boolean;
  imageStatus: InventoryImageStatus;
  originalImageUrl: string | null;
  firstSyncedAt: string;
  lastSeenAt: string;
  updatedAt: string;
  unavailableSince: string | null;
  syncRunId: string;
};

type InventorySyncState = {
  status?: "RUNNING" | "SUCCEEDED" | "FAILED";
  lockedUntil?: unknown;
  lastStartedAt?: string;
  lastSuccessfulAt?: string;
  lastFailedAt?: string;
  lastSyncError?: string | null;
  failedSyncs?: number;
  sourceUrl?: string;
  sourceType?: string;
  totalVehiclesReceived?: number;
  totalVehiclesStored?: number;
  missingVehicles?: number;
  duplicateVehicles?: number;
  brokenImageLinks?: number;
  vehiclesCreated?: number;
  vehiclesUpdated?: number;
  vehiclesInactivated?: number;
  lastSyncDurationMs?: number;
};

export type InventorySyncResult = RoarInventoryDiagnostics & {
  syncRunId: string;
  status: "SUCCEEDED";
  startedAt: string;
  completedAt: string;
  sourceType: string;
};

export class InventorySyncInProgressError extends Error {
  constructor() {
    super("An inventory synchronization is already running");
    this.name = "InventorySyncInProgressError";
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

export function isInventoryVehicleAvailable(status: string | null | undefined): boolean {
  return !/sold|inactive|reserved|unavailable/i.test(status ?? "");
}

export function getInventoryCanonicalKey(vehicle: RoarInventoryVehicle): string {
  const source = normalizeIdentity(vehicle.source || SOURCE_NAME);
  const sourceId = normalizeIdentity(vehicle.id);
  const listingUrl = normalizeIdentity(vehicle.listingUrl);
  return `${source}|${sourceId || listingUrl}`;
}

function getInventoryDocumentId(vehicle: RoarInventoryVehicle): string {
  return crypto.createHash("sha256").update(getInventoryCanonicalKey(vehicle)).digest("hex").slice(0, 40);
}

function getVehicleContentHash(vehicle: RoarInventoryVehicle, imageStatus: InventoryImageStatus): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        title: vehicle.title,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.priceNumber ?? vehicle.price,
        mileage: vehicle.mileageNumber ?? vehicle.mileage,
        transmission: vehicle.transmission,
        fuelType: vehicle.fuelType,
        bodyType: vehicle.bodyType,
        imageUrl: vehicle.imageUrl,
        listingUrl: vehicle.listingUrl,
        status: vehicle.status,
        imageStatus,
      }),
    )
    .digest("hex");
}

export function deduplicateInventoryVehicles(vehicles: RoarInventoryVehicle[]): {
  vehicles: RoarInventoryVehicle[];
  duplicateCount: number;
} {
  const seenCanonicalKeys = new Set<string>();
  const seenListingUrls = new Set<string>();
  const unique: RoarInventoryVehicle[] = [];
  let duplicateCount = 0;

  for (const vehicle of vehicles) {
    const canonicalKey = getInventoryCanonicalKey(vehicle);
    const listingUrl = normalizeIdentity(vehicle.listingUrl);
    if (seenCanonicalKeys.has(canonicalKey) || (listingUrl && seenListingUrls.has(listingUrl))) {
      duplicateCount += 1;
      continue;
    }
    seenCanonicalKeys.add(canonicalKey);
    if (listingUrl) seenListingUrls.add(listingUrl);
    unique.push(vehicle);
  }

  return { vehicles: unique, duplicateCount };
}

export function findMissingAvailableInventoryVehicles(
  existing: PersistedInventoryVehicle[],
  incomingCanonicalKeys: Set<string>,
): PersistedInventoryVehicle[] {
  return existing.filter(
    (vehicle) =>
      !incomingCanonicalKeys.has(vehicle.canonicalKey || getInventoryCanonicalKey(vehicle)) &&
      vehicle.isAvailable,
  );
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

async function acquireSyncLock(syncRunId: string, startedAt: string): Promise<void> {
  const db = getFirebaseAdmin();
  const stateRef = db.collection(SYNC_STATE_COLLECTION).doc(SYNC_STATE_ID);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(stateRef);
    const state = (snapshot.data() ?? {}) as InventorySyncState;
    if (state.status === "RUNNING" && toMillis(state.lockedUntil) > Date.now()) {
      throw new InventorySyncInProgressError();
    }
    transaction.set(
      stateRef,
      {
        status: "RUNNING",
        syncRunId,
        lastStartedAt: startedAt,
        lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
        lastSyncError: null,
        sourceUrl: ROAR_INVENTORY_SOURCE_URL,
      },
      { merge: true },
    );
  });
}

function buildGovernanceEvent(args: {
  eventType: string;
  syncRunId: string;
  occurredAt: string;
  entityType: "inventorySync" | "inventoryVehicle";
  entityId: string;
  latencyMs?: number;
  mutatedFields?: string[];
  actor?: { actorId?: string; actorEmail?: string; actorRole?: string };
}): GovernanceEvent {
  return {
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: args.occurredAt,
    category: "recomputation",
    eventType: args.eventType,
    correlation: { correlationId: args.syncRunId, requestId: args.syncRunId },
    actor: args.actor,
    source: {
      sourceType: "service",
      sourceName: "durableInventorySync",
      sourceClassification: "canonical",
    },
    entity: { entityType: args.entityType, entityId: args.entityId },
    mutation: { mutatedFields: args.mutatedFields ?? [] },
    governance: {
      sourceClassification: "canonical",
      authorityClassification: "source_of_truth",
      latencyMs: args.latencyMs ?? null,
      failOpen: false,
    },
  };
}

async function recordGovernanceEvent(event: GovernanceEvent): Promise<void> {
  await persistGovernanceEvent(event);
  console.info("[inventory-governance]", {
    eventType: event.eventType,
    entityId: event.entity?.entityId,
    correlationId: event.correlation.correlationId,
  });
}

async function checkImageUrl(imageUrl: string | null): Promise<InventoryImageStatus> {
  if (!imageUrl) return "MISSING";
  if (imageUrl.startsWith("/")) return "VALID";

  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return "BROKEN";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "BROKEN";
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "roarcarssa.com" && !hostname.endsWith(".roarcarssa.com")) return "UNKNOWN";

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 410) return "BROKEN";
    if (response.ok) return "VALID";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

async function inspectImages(vehicles: RoarInventoryVehicle[]): Promise<Map<string, InventoryImageStatus>> {
  const statuses = new Map<string, InventoryImageStatus>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(8, Math.max(1, vehicles.length)) }, async () => {
    while (cursor < vehicles.length) {
      const index = cursor;
      cursor += 1;
      const vehicle = vehicles[index];
      statuses.set(getInventoryCanonicalKey(vehicle), await checkImageUrl(vehicle.imageUrl));
    }
  });
  await Promise.all(workers);
  return statuses;
}

function toPersistedVehicle(firestoreId: string, data: Record<string, unknown>): PersistedInventoryVehicle {
  return {
    firestoreId,
    recordType: "vehicle",
    sourceVehicleId: asString(data.sourceVehicleId) || asString(data.id),
    canonicalKey: asString(data.canonicalKey),
    contentHash: asString(data.contentHash),
    isAvailable: data.isAvailable !== false,
    imageStatus: (asString(data.imageStatus) || "UNKNOWN") as InventoryImageStatus,
    originalImageUrl: asString(data.originalImageUrl) || null,
    firstSyncedAt: asString(data.firstSyncedAt),
    lastSeenAt: asString(data.lastSeenAt),
    updatedAt: asString(data.updatedAt),
    unavailableSince: asString(data.unavailableSince) || null,
    syncRunId: asString(data.syncRunId),
    id: asString(data.id) || asString(data.sourceVehicleId),
    title: asString(data.title),
    make: asString(data.make),
    model: asString(data.model),
    year: asNumber(data.year),
    price: asNumber(data.price),
    priceNumber: asNumber(data.priceNumber ?? data.price),
    mileage: asNumber(data.mileage),
    mileageNumber: asNumber(data.mileageNumber ?? data.mileage),
    transmission: asString(data.transmission) || null,
    fuelType: asString(data.fuelType) || null,
    bodyType: asString(data.bodyType) || null,
    imageUrl: asString(data.imageUrl) || null,
    listingUrl: asString(data.listingUrl),
    status: asString(data.status) || "INACTIVE",
    source: asString(data.source) || SOURCE_NAME,
    lastSyncedAt: asString(data.lastSyncedAt) || asString(data.lastSeenAt),
  };
}

function calculateMetrics(vehicles: RoarInventoryVehicle[]): RoarInventoryMetrics {
  const active = vehicles.filter((vehicle) => isInventoryVehicleAvailable(vehicle.status));
  const priced = active.filter((vehicle) => typeof vehicle.priceNumber === "number" && vehicle.priceNumber > 0);
  const currentYear = new Date().getFullYear();
  const modelAges = active.flatMap((vehicle) => (vehicle.year ? [Math.max(0, currentYear - vehicle.year)] : []));
  const inventoryValue = priced.reduce((total, vehicle) => total + Number(vehicle.priceNumber ?? 0), 0);
  return {
    activeVehicles: active.length,
    inventoryValue,
    averageVehiclePrice: priced.length ? Math.round(inventoryValue / priced.length) : 0,
    averageModelAge: modelAges.length
      ? Number((modelAges.reduce((total, age) => total + age, 0) / modelAges.length).toFixed(1))
      : null,
    vehiclesAddedThisMonth: vehicles.filter((vehicle) => {
      const firstSyncedAt = (vehicle as Partial<PersistedInventoryVehicle>).firstSyncedAt;
      if (!firstSyncedAt) return false;
      const date = new Date(firstSyncedAt);
      const now = new Date();
      return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
    }).length,
  };
}

function diagnosticsFromState(state: InventorySyncState, storedCount: number): RoarInventoryDiagnostics {
  return {
    totalVehiclesReceived: state.totalVehiclesReceived ?? 0,
    totalVehiclesStored: state.totalVehiclesStored ?? storedCount,
    missingVehicles: state.missingVehicles ?? 0,
    duplicateVehicles: state.duplicateVehicles ?? 0,
    failedSyncs: state.failedSyncs ?? 0,
    brokenImageLinks: state.brokenImageLinks ?? 0,
    vehiclesCreated: state.vehiclesCreated ?? 0,
    vehiclesUpdated: state.vehiclesUpdated ?? 0,
    vehiclesInactivated: state.vehiclesInactivated ?? 0,
    lastSyncDurationMs: state.lastSyncDurationMs ?? null,
    lastSyncError: state.lastSyncError ?? null,
  };
}

export async function synchronizeRoarInventory(actor?: {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
}): Promise<InventorySyncResult> {
  const syncRunId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const db = getFirebaseAdmin();
  const stateRef = db.collection(SYNC_STATE_COLLECTION).doc(SYNC_STATE_ID);

  await acquireSyncLock(syncRunId, startedAt);

  try {
    await recordGovernanceEvent(
      buildGovernanceEvent({ eventType: "inventory_sync_started", syncRunId, occurredAt: startedAt, entityType: "inventorySync", entityId: SYNC_STATE_ID, actor }),
    );
    const sourceResponse = await fetchLiveRoarInventory();
    if (sourceResponse.vehicles.length === 0) throw new Error("Inventory source returned zero vehicles");

    const deduplicated = deduplicateInventoryVehicles(sourceResponse.vehicles);
    const imageStatuses = await inspectImages(deduplicated.vehicles);
    const existingSnapshot = await db.collection(INVENTORY_COLLECTION).get();
    const existing = existingSnapshot.docs
      .filter((doc) => (doc.data() as Record<string, unknown>).recordType !== "syncState")
      .map((doc) => toPersistedVehicle(doc.id, doc.data() as Record<string, unknown>))
      .filter((vehicle) => vehicle.source === SOURCE_NAME);
    const existingByCanonicalKey = new Map(existing.map((vehicle) => [vehicle.canonicalKey || getInventoryCanonicalKey(vehicle), vehicle]));
    const incomingCanonicalKeys = new Set<string>();
    const creates: PersistedInventoryVehicle[] = [];
    const updates: PersistedInventoryVehicle[] = [];
    const touches: PersistedInventoryVehicle[] = [];

    for (const vehicle of deduplicated.vehicles) {
      const canonicalKey = getInventoryCanonicalKey(vehicle);
      incomingCanonicalKeys.add(canonicalKey);
      const imageStatus = imageStatuses.get(canonicalKey) ?? "UNKNOWN";
      const normalizedVehicle: RoarInventoryVehicle = {
        ...vehicle,
        imageUrl: imageStatus === "BROKEN" ? PLACEHOLDER_IMAGE_URL : vehicle.imageUrl || PLACEHOLDER_IMAGE_URL,
        status: vehicle.status || "ACTIVE",
        source: SOURCE_NAME,
        lastSyncedAt: sourceResponse.syncedAt,
      };
      const contentHash = getVehicleContentHash(normalizedVehicle, imageStatus);
      const previous = existingByCanonicalKey.get(canonicalKey);
      const record: PersistedInventoryVehicle = {
        ...normalizedVehicle,
        firestoreId: previous?.firestoreId ?? getInventoryDocumentId(normalizedVehicle),
        recordType: "vehicle",
        sourceVehicleId: vehicle.id,
        canonicalKey,
        contentHash,
        isAvailable: isInventoryVehicleAvailable(normalizedVehicle.status),
        imageStatus,
        originalImageUrl: vehicle.imageUrl,
        firstSyncedAt: previous?.firstSyncedAt || sourceResponse.syncedAt,
        lastSeenAt: sourceResponse.syncedAt,
        updatedAt: previous?.contentHash === contentHash ? previous.updatedAt : sourceResponse.syncedAt,
        unavailableSince: isInventoryVehicleAvailable(normalizedVehicle.status) ? null : previous?.unavailableSince || sourceResponse.syncedAt,
        syncRunId,
      };
      if (!previous) creates.push(record);
      else if (previous.contentHash !== contentHash || previous.isAvailable !== record.isAvailable) updates.push(record);
      else touches.push(record);
    }

    const missing = findMissingAvailableInventoryVehicles(existing, incomingCanonicalKeys);
    const batchWrites: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];
    for (const record of [...creates, ...updates, ...touches]) {
      const { firestoreId, ...data } = record;
      batchWrites.push({ ref: db.collection(INVENTORY_COLLECTION).doc(firestoreId), data });
    }
    for (const vehicle of missing) {
      batchWrites.push({
        ref: db.collection(INVENTORY_COLLECTION).doc(vehicle.firestoreId),
        data: {
          status: "INACTIVE",
          isAvailable: false,
          unavailableSince: sourceResponse.syncedAt,
          updatedAt: sourceResponse.syncedAt,
          syncRunId,
        },
      });
    }

    for (let offset = 0; offset < batchWrites.length; offset += 400) {
      const batch = db.batch();
      for (const write of batchWrites.slice(offset, offset + 400)) batch.set(write.ref, write.data, { merge: true });
      await batch.commit();
    }

    const completedAt = new Date().toISOString();
    const lastSyncDurationMs = Date.now() - startedMs;
    const totalVehiclesStored = existing.length + creates.length;
    const brokenImageLinks = [...imageStatuses.values()].filter((status) => status === "BROKEN").length;
    const currentState = (await stateRef.get()).data() as InventorySyncState | undefined;
    const diagnostics: RoarInventoryDiagnostics = {
      totalVehiclesReceived: sourceResponse.vehicles.length,
      totalVehiclesStored,
      missingVehicles: missing.length,
      duplicateVehicles: deduplicated.duplicateCount,
      failedSyncs: currentState?.failedSyncs ?? 0,
      brokenImageLinks,
      vehiclesCreated: creates.length,
      vehiclesUpdated: updates.length,
      vehiclesInactivated: missing.length,
      lastSyncDurationMs,
      lastSyncError: null,
    };

    await stateRef.set(
      {
        status: "SUCCEEDED",
        lockedUntil: null,
        lastSuccessfulAt: completedAt,
        lastSyncError: null,
        sourceUrl: sourceResponse.source.url,
        sourceType: sourceResponse.source.type,
        ...diagnostics,
      },
      { merge: true },
    );

    await Promise.all([
      ...creates.map((vehicle) =>
        recordGovernanceEvent(
          buildGovernanceEvent({
            eventType: "inventory_vehicle_created",
            syncRunId,
            occurredAt: completedAt,
            entityType: "inventoryVehicle",
            entityId: vehicle.sourceVehicleId,
            mutatedFields: ["inventory"],
            actor,
          }),
        ),
      ),
      ...[...updates, ...missing].map((vehicle) =>
        recordGovernanceEvent(
          buildGovernanceEvent({
            eventType: "inventory_vehicle_updated",
            syncRunId,
            occurredAt: completedAt,
            entityType: "inventoryVehicle",
            entityId: vehicle.sourceVehicleId,
            mutatedFields: ["inventory", "status", "availability"],
            actor,
          }),
        ),
      ),
      recordGovernanceEvent(
        buildGovernanceEvent({
          eventType: "inventory_sync_succeeded",
          syncRunId,
          occurredAt: completedAt,
          entityType: "inventorySync",
          entityId: SYNC_STATE_ID,
          latencyMs: lastSyncDurationMs,
          actor,
        }),
      ),
    ]);

    return {
      ...diagnostics,
      syncRunId,
      status: "SUCCEEDED",
      startedAt,
      completedAt,
      sourceType: sourceResponse.source.type,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Inventory synchronization failed";
    const lastSyncDurationMs = Date.now() - startedMs;
    await stateRef.set(
      {
        status: "FAILED",
        lockedUntil: null,
        lastFailedAt: completedAt,
        lastSyncError: message,
        failedSyncs: FieldValue.increment(1),
        lastSyncDurationMs,
      },
      { merge: true },
    );
    await recordGovernanceEvent(
      buildGovernanceEvent({
        eventType: "inventory_sync_failed",
        syncRunId,
        occurredAt: completedAt,
        entityType: "inventorySync",
        entityId: SYNC_STATE_ID,
        latencyMs: lastSyncDurationMs,
        actor,
      }),
    );
    throw error;
  }
}

export async function getPersistedRoarInventory(options?: { bootstrapIfEmpty?: boolean }): Promise<RoarInventoryResponse> {
  const db = getFirebaseAdmin();
  const [inventorySnapshot, stateSnapshot] = await Promise.all([
    db.collection(INVENTORY_COLLECTION).get(),
    db.collection(SYNC_STATE_COLLECTION).doc(SYNC_STATE_ID).get(),
  ]);
  const vehicles = inventorySnapshot.docs
    .filter((doc) => (doc.data() as Record<string, unknown>).recordType !== "syncState")
    .map((doc) => toPersistedVehicle(doc.id, doc.data() as Record<string, unknown>))
    .filter((vehicle) => vehicle.source === SOURCE_NAME)
    .sort((left, right) => left.title.localeCompare(right.title));
  const state = (stateSnapshot.data() ?? {}) as InventorySyncState;

  if (vehicles.length === 0 && options?.bootstrapIfEmpty) {
    try {
      await synchronizeRoarInventory({ actorId: "inventory-bootstrap", actorRole: "system" });
      return getPersistedRoarInventory({ bootstrapIfEmpty: false });
    } catch (error) {
      return {
        vehicles: [],
        metrics: calculateMetrics([]),
        status: "UNAVAILABLE",
        syncedAt: state.lastSuccessfulAt ?? new Date().toISOString(),
        sourceUrl: ROAR_INVENTORY_SOURCE_URL,
        itemCount: 0,
        source: { type: "unavailable", url: ROAR_INVENTORY_SOURCE_URL, lastSyncedAt: state.lastSuccessfulAt ?? "" },
        diagnostics: diagnosticsFromState(state, 0),
        warning: error instanceof Error ? error.message : "Inventory synchronization failed",
      };
    }
  }

  const lastSuccessfulAt = state.lastSuccessfulAt ?? vehicles[0]?.lastSeenAt ?? "";
  const freshnessMs = lastSuccessfulAt ? Date.now() - new Date(lastSuccessfulAt).getTime() : Number.POSITIVE_INFINITY;
  const stale = freshnessMs > FRESH_INVENTORY_MS;
  return {
    vehicles,
    metrics: calculateMetrics(vehicles),
    status: vehicles.length === 0 ? "UNAVAILABLE" : stale ? "CACHED" : "LIVE",
    syncedAt: lastSuccessfulAt || new Date().toISOString(),
    sourceUrl: ROAR_INVENTORY_SOURCE_URL,
    itemCount: vehicles.length,
    source: { type: "firestore", url: state.sourceUrl ?? ROAR_INVENTORY_SOURCE_URL, lastSyncedAt: lastSuccessfulAt },
    diagnostics: diagnosticsFromState(state, vehicles.length),
    warning: state.lastSyncError
      ? `Last inventory sync failed: ${state.lastSyncError}. Persisted inventory is shown.`
      : stale && vehicles.length > 0
        ? "Persisted inventory is stale; the scheduled synchronization requires attention."
        : undefined,
  };
}

export async function getAvailableInventoryVehicle(sourceVehicleId: string): Promise<PersistedInventoryVehicle | null> {
  const snapshot = await getFirebaseAdmin()
    .collection(INVENTORY_COLLECTION)
    .where("sourceVehicleId", "==", sourceVehicleId)
    .limit(1)
    .get();
  const document = snapshot.docs[0];
  if (!document) return null;
  const vehicle = toPersistedVehicle(document.id, document.data() as Record<string, unknown>);
  return vehicle.isAvailable && isInventoryVehicleAvailable(vehicle.status) ? vehicle : null;
}
