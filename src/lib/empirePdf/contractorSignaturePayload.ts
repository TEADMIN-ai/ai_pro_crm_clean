export type EmpirePdfContractorSignaturePayload = {
  contractorId: string;
  acknowledgementId: string;
  signatureText: string;
  signedByName: string;
  signedByCapacity: string;
  signedAt: string;
  acknowledgementVersion: string;
  userUid: string;
};

export function buildEmpirePdfContractorSignaturePayload(
  signature: EmpirePdfContractorSignaturePayload | null,
): EmpirePdfContractorSignaturePayload | null {
  if (!signature) {
    return null;
  }

  return {
    contractorId: signature.contractorId,
    acknowledgementId: signature.acknowledgementId,
    signatureText: signature.signatureText,
    signedByName: signature.signedByName,
    signedByCapacity: signature.signedByCapacity,
    signedAt: signature.signedAt,
    acknowledgementVersion: signature.acknowledgementVersion,
    userUid: signature.userUid,
  };
}
