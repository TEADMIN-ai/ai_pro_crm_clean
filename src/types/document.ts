export type ContractorDocument = {
  id: string
  contractorId: string
  name: string
  storagePath: string
  downloadURL: string
  uploadedBy: string
  uploadedAt: number
  status: "active" | "expired" | "replaced"
  expiresAt: number | null
  docType: string | null
}
