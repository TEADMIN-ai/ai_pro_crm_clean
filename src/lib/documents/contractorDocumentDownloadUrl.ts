export function buildContractorDocumentDownloadUrl(contractorId: string, documentType: string) {
  return `/api/contractors/${encodeURIComponent(contractorId)}/documents/${encodeURIComponent(documentType)}/download`;
}
