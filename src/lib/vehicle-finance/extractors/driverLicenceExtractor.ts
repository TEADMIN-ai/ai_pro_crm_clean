export type DriverLicenceExtraction = {
  name: string | null;
  surname: string | null;
  idNumber: string | null;
  licenceNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenceCode: string | null;
  confidence: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: string): string {
  return (value ?? "").replace(/\r/g, "\n");
}

function findLineValue(text: string, labels: RegExp[]): string | null {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  for (const label of labels) {
    for (const line of lines) {
      const match = line.match(new RegExp(`^${label.source}\\s*[:\\-]?\\s*(.+)$`, "i"));
      if (match?.[1]) {
        const value = match[1].trim();
        if (value) {
          return value;
        }
      }
    }
  }

  return null;
}

function pickNameParts(text: string): { name: string | null; surname: string | null } {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  let name: string | null = null;
  let surname: string | null = null;

  for (const line of lines) {
    const nameMatch = line.match(/^(?:name|given names?)\s*[:\-]?\s*(.+)$/i);
    if (nameMatch?.[1]) {
      const value = nameMatch[1].trim();
      if (value && !/^surname$/i.test(value)) {
        name = value;
      }
      continue;
    }

    const surnameMatch = line.match(/^(?:surname|family name)\s*[:\-]?\s*(.+)$/i);
    if (surnameMatch?.[1]) {
      const value = surnameMatch[1].trim();
      if (value && !/^name$/i.test(value)) {
        surname = value;
      }
    }
  }

  if (!name || !surname) {
    const compact = text.replace(/\s+/g, " ").trim();
    const fullNameMatch = compact.match(/\bname\s*[:\-]?\s*([A-Za-z][A-Za-z' -]{1,}\s+[A-Za-z][A-Za-z' -]{1,})/i);
    if (fullNameMatch?.[1]) {
      const parts = fullNameMatch[1].trim().split(/\s+/);
      if (parts.length >= 2) {
        name = name ?? parts.slice(0, -1).join(" ");
        surname = surname ?? parts.slice(-1).join(" ");
      }
    }
  }

  return { name, surname };
}

function pickDate(text: string, labels: RegExp[]): string | null {
  const datePattern = /(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/;
  for (const label of labels) {
    const match = text.match(new RegExp(`${label.source}\\s*[:\\-]?\\s*${datePattern.source}`, "i"));
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

export function extractDriverLicenceDetails(text: string): DriverLicenceExtraction {
  try {
    const normalized = normalizeText(text);
    const compact = normalized.replace(/\s+/g, " ").trim();
    const { name, surname } = pickNameParts(normalized);
    const idNumber = compact.match(/\b\d{13}\b/)?.[0] ?? findLineValue(normalized, [/\bid\s+number/i, /\bidentity\s+number/i]);
    const licenceNumber = findLineValue(normalized, [/\blicen[cs]e\s+number/i, /\bdriver\s+licen[cs]e\s+number/i, /\bdl\s+number/i]);
    const licenceCode = findLineValue(normalized, [/\blicen[cs]e\s+code/i, /\bcode\b/i]);
    const issueDate = pickDate(normalized, [/\bissue(?:d)?\s+date/i, /\bdate\s+of\s+issue/i]);
    const expiryDate = pickDate(normalized, [/\bexpiry\s+date/i, /\bvalid\s+until/i, /\bdate\s+of\s+expiry/i]);
    const confidenceSignals = [name, surname, idNumber, licenceNumber, issueDate, expiryDate, licenceCode].filter(Boolean).length;

    return {
      name,
      surname,
      idNumber: idNumber?.trim() || null,
      licenceNumber: licenceNumber?.trim() || null,
      issueDate,
      expiryDate,
      licenceCode: licenceCode?.trim() || null,
      confidence: clamp(confidenceSignals * 15),
    };
  } catch {
    return {
      name: null,
      surname: null,
      idNumber: null,
      licenceNumber: null,
      issueDate: null,
      expiryDate: null,
      licenceCode: null,
      confidence: 0,
    };
  }
}
