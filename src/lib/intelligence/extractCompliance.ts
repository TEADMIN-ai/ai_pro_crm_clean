export function extractComplianceData(text: string) {
  if (!text || typeof text !== "string") {
    return {
      hasCIPC: false,
      hasTaxClearance: false,
      hasBBBEE: false,
      hasCOIDA: false,
    };
  }

  const cleanText = text.toLowerCase().replace(/\s+/g, " ");
  const registrationPatterns = [
    /\b\d{4}\s*\/\s*\d{5,7}\s*\/\s*\d{2}\b/,
    /\bK\d{10}\b/i,
  ];
  const patternMatch = registrationPatterns.some((pattern) => pattern.test(text));
  const keywordMatch =
    cleanText.includes("companies and intellectual property commission") ||
    cleanText.includes("cipc") ||
    cleanText.includes("registration certificate") ||
    cleanText.includes("registration number");

  return {
    hasCIPC: patternMatch || keywordMatch,
    hasTaxClearance: cleanText.includes("tax clearance"),
    hasBBBEE: cleanText.includes("bbbee") || cleanText.includes("b-bbee"),
    hasCOIDA: cleanText.includes("coida"),
  };
}
