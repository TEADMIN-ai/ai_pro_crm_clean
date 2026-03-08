export type DocumentIntelligenceResult = {
  extractedFields: {
    expiryDates: string[];
    registrationNumbers: string[];
  };
  flags: {
    expired: boolean;
    duplicatePatternDetected: boolean;
  };
  confidenceScore: number;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseDateCandidate(raw: string): Date | null {
  const value = raw.trim();

  if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(value)) {
    const [year, month, day] = value.split(/[/-]/).map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value)) {
    const [day, month, year] = value.split(/[/-]/).map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function extractMatches(source: string, regex: RegExp): string[] {
  const matches = source.matchAll(regex);
  const values: string[] = [];
  for (const match of matches) {
    if (match[1]) {
      values.push(match[1]);
      continue;
    }
    if (match[0]) {
      values.push(match[0]);
    }
  }
  return values;
}

export function analyzeUploadedDocument(buffer: Buffer, fileName: string): DocumentIntelligenceResult {
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const latinText = new TextDecoder("latin1", { fatal: false }).decode(buffer);
  const sourceText = `${fileName}\n${utf8Text}\n${latinText}`;

  const isoAndSlashDates = extractMatches(
    sourceText,
    /\b(?:\d{4}[/-]\d{2}[/-]\d{2}|\d{2}[/-]\d{2}[/-]\d{4})\b/g
  );

  const cidbNumbers = extractMatches(
    sourceText,
    /\bCIDB[\s:.-]*(?:CRS[\s:.-]*)?([A-Z0-9/-]{4,20})\b/gi
  );
  const vatNumbers = extractMatches(
    sourceText,
    /\bVAT(?:\s*(?:No|Number|#))?[\s:.-]*(\d{10})\b/gi
  );
  const companyRegNumbers = extractMatches(
    sourceText,
    /\b((?:19|20)\d{2}\/\d{6}\/\d{2})\b/g
  );

  const expiryDates = unique(isoAndSlashDates);
  const registrationNumbersRaw = [
    ...cidbNumbers.map((value) => `CIDB:${value.toUpperCase()}`),
    ...vatNumbers.map((value) => `VAT:${value}`),
    ...companyRegNumbers.map((value) => `REG:${value}`),
  ];
  const registrationNumbers = unique(registrationNumbersRaw);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expired = expiryDates.some((candidate) => {
    const parsed = parseDateCandidate(candidate);
    if (!parsed) return false;
    parsed.setHours(0, 0, 0, 0);
    return parsed.getTime() < today.getTime();
  });

  const regNumberCounts = registrationNumbersRaw.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  const duplicatePatternDetected = Object.values(regNumberCounts).some((count) => count > 1);

  const signalCount =
    (expiryDates.length > 0 ? 1 : 0) +
    (registrationNumbers.length > 0 ? 1 : 0) +
    (expired ? 1 : 0) +
    (duplicatePatternDetected ? 1 : 0);
  const confidenceScore = Math.min(100, Math.round((signalCount / 4) * 100));

  return {
    extractedFields: {
      expiryDates,
      registrationNumbers,
    },
    flags: {
      expired,
      duplicatePatternDetected,
    },
    confidenceScore,
  };
}
