import { inferHygieneRecordClassification, isVisibleHygieneClassification } from "@/lib/hygiene/recordClassification"
import type { HygieneDashboardData } from "@/types/hygiene"

type HygieneDashboardCollections = Omit<HygieneDashboardData, "kpis">

export type HygieneVisibilityOptions = {
  includeTestData?: boolean
}

function visible(record: Record<string, unknown>, options: HygieneVisibilityOptions): boolean {
  return isVisibleHygieneClassification(inferHygieneRecordClassification(record), options)
}

function visibleClientRecord(record: { clientId?: string }, visibleClientIds: Set<string>) {
  if (typeof record.clientId !== "string") return false
  return visibleClientIds.has(record.clientId)
}

function visibleClientClassRecord(record: { clientId?: string }, visibleClientIds: Set<string>, options: HygieneVisibilityOptions) {
  if (!visibleClientRecord(record, visibleClientIds)) return false
  return visible(record as unknown as Record<string, unknown>, options)
}

function visibleCollectionRecord(record: { clientId?: string, collectionId: string }, visibleClientIds: Set<string>, visibleCollectionIds: Set<string>, options: HygieneVisibilityOptions) {
  if (!visibleClientRecord(record, visibleClientIds)) return false
  if (!visibleCollectionIds.has(record.collectionId)) return false
  return visible(record as unknown as Record<string, unknown>, options)
}

export function filterHygieneDashboardDataForVisibility(
  data: HygieneDashboardCollections,
  options: HygieneVisibilityOptions = {},
): HygieneDashboardCollections {
  const clients = data.clients.filter((client) => visible(client as unknown as Record<string, unknown>, options))
  const visibleClientIds = new Set(clients.map((client) => client.clientId))
  const hiddenClientNames = new Set(
    data.clients
      .filter((client) => !visibleClientIds.has(client.clientId))
      .map((client) => client.clientName.trim().toLowerCase()),
  )

  const ownerIsVisible = (record: { owner?: string }) => {
    const owner = typeof record.owner === "string" ? record.owner.trim().toLowerCase() : ""
    if (!owner) return true
    return !hiddenClientNames.has(owner)
  }

  const collections = data.collections.filter((record) => visibleClientClassRecord(record, visibleClientIds, options))
  const visibleCollectionIds = new Set(collections.map((collection) => collection.collectionId))

  return {
    clients,
    sites: data.sites.filter((record) => visibleClientClassRecord(record, visibleClientIds, options)),
    assets: data.assets.filter((record) => visibleClientClassRecord(record, visibleClientIds, options)),
    collections,
    manifests: data.manifests.filter((record) => visibleClientClassRecord(record, visibleClientIds, options)),
    evidencePhotos: data.evidencePhotos.filter((record) => visibleCollectionRecord(record, visibleClientIds, visibleCollectionIds, options)),
    vehicleInspections: data.vehicleInspections.filter((record) => visible(record as unknown as Record<string, unknown>, options)),
    driverLogs: data.driverLogs.filter((record) => visible(record as unknown as Record<string, unknown>, options)),
    complianceDocuments: data.complianceDocuments.filter((record) => {
      if (!ownerIsVisible(record)) return false
      return visible(record as unknown as Record<string, unknown>, options)
    }),
    reports: data.reports.filter((record) => visible(record as unknown as Record<string, unknown>, options)),
    jobEvents: data.jobEvents?.filter((record) => visibleCollectionRecord(record, visibleClientIds, visibleCollectionIds, options)),
    signatures: data.signatures?.filter((record) => visibleCollectionRecord(record, visibleClientIds, visibleCollectionIds, options)),
  }
}
