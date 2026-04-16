export function validateDocument(docType: string, text: string) {
  const result: {
    valid: boolean;
    issues: string[];
    extracted: Record<string, string>;
  } = {
    valid: false,
    issues: [],
    extracted: {},
  };

  if (docType === "cipc") {
    const match = text.match(/\b\d{4}\/\d{6}\/\d{2}\b/);

    if (match) {
      result.valid = true;
      result.extracted.registrationNumber = match[0];
    } else {
      result.issues.push("CIPC registration number not found");
    }
  }

  if (docType === "tax") {
    const match = text.match(/\b\d{10}\b/);

    if (match) {
      result.valid = true;
      result.extracted.taxNumber = match[0];
    } else {
      result.issues.push("Tax number not found");
    }
  }

  if (docType === "coida") {
    const expiry = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);

    if (expiry) {
      const [day, month, year] = expiry[0].split("/");
      const date = new Date(`${year}-${month}-${day}T00:00:00`);
      result.extracted.expiryDate = expiry[0];

      if (date < new Date()) {
        result.issues.push("COIDA expired");
      } else {
        result.valid = true;
      }
    } else {
      result.issues.push("Expiry date not found");
    }
  }

  if (docType === "bbbee") {
    if (text.toLowerCase().includes("bbbee")) {
      result.valid = true;
    } else {
      result.issues.push("B-BBEE certificate not detected");
    }
  }

  return result;
}
