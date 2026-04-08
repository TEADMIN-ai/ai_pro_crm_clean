export function getPermissions(role: string) {
  return {
    canGeneratePack: role !== "contractor",
    canAnalyzeDeal: role !== "contractor",
    canUploadDocs: role !== "contractor",
    canEditDeal: role !== "contractor",
  };
}
