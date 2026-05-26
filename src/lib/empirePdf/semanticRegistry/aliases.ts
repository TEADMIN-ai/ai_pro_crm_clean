function normalizeAliasValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeSemanticAlias(value: string): string {
  return normalizeAliasValue(value);
}

export function findMatchingAlias(candidates: string[], anchorText: string): string {
  const normalizedAnchor = normalizeAliasValue(anchorText);

  for (const candidate of candidates) {
    if (normalizeAliasValue(candidate) === normalizedAnchor) {
      return candidate;
    }
  }

  return candidates[0] ?? anchorText;
}
