type ExtractedDocumentData = {
  rawText: string;
  hasCIPC: boolean;
  hasTax: boolean;
  hasBBEEE: boolean;
  hasCOIDA: boolean;
};

export function validateDocument(data: ExtractedDocumentData, documentType?: string) {
  const issues: string[] = [];

  if (!data.rawText || data.rawText.length < 50) {
    issues.push("Document unreadable or empty");
  }

  switch (documentType) {
    case "cipc":
      if (!data.hasCIPC) {
        issues.push("Missing CIPC registration");
      }
      break;
    case "taxClearance":
      if (!data.hasTax) {
        issues.push("Missing tax clearance");
      }
      break;
    case "bbbee":
      if (!data.hasBBEEE) {
        issues.push("Missing B-BBEE certificate evidence");
      }
      break;
    case "coida":
      if (!data.hasCOIDA) {
        issues.push("Missing COIDA evidence");
      }
      break;
    default:
      if (!data.hasCIPC) {
        issues.push("Missing CIPC registration");
      }
      if (!data.hasTax) {
        issues.push("Missing tax clearance");
      }
      break;
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
