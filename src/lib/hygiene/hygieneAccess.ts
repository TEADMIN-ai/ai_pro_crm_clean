import { AuthorizationError, type AuthorizedUser } from "@/lib/server/authz";

export const HYGIENE_COLLECTIONS = {
  clients: "hygieneClients",
  sites: "hygieneSites",
  assets: "hygieneBinAssets",
  collections: "hygieneCollections",
  manifests: "hygieneManifests",
  evidencePhotos: "hygieneEvidence",
  vehicleInspections: "hygieneVehicleInspections",
  driverLogs: "hygieneDriverLogs",
  complianceDocuments: "hygieneComplianceDocuments",
  reports: "hygieneReports",
  jobEvents: "hygieneJobEvents",
  signatures: "hygieneSignatures",
} as const;

export function assertHygieneInternalAccess(user: AuthorizedUser): void {
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff" && user.role !== "driver") {
    throw new AuthorizationError("Hygiene dashboard is restricted to internal Torque Empire users.", 403);
  }
}
