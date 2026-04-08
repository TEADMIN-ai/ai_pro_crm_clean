export function generateFixSuggestions(deal: any) {
  const suggestions: string[] = [];

  if (!deal.missingDocs || deal.missingDocs.length === 0) {
    return ["All compliance documents are in place. You're ready to proceed."];
  }

  deal.missingDocs.forEach((doc: string) => {
    switch (doc) {
      case "tax":
        suggestions.push("Upload a valid Tax Clearance Certificate.");
        break;
      case "bbbee":
        suggestions.push("Provide a valid B-BBEE certificate.");
        break;
      case "cipc":
        suggestions.push("Upload your CIPC registration document.");
        break;
      case "coida":
        suggestions.push("Submit a valid COIDA certificate.");
        break;
      default:
        suggestions.push(`Upload required document: ${doc}`);
    }
  });

  if (deal.riskLevel === "HIGH") {
    suggestions.push("High risk of rejection. Complete all required documents before proceeding.");
  }

  return suggestions;
}
