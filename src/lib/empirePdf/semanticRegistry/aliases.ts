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

function countSharedTokens(candidate: string, anchor: string): number {
  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
  const anchorTokens = anchor.split(" ").filter(Boolean);

  return anchorTokens.reduce((count, token) => count + (candidateTokens.has(token) ? 1 : 0), 0);
}

export function isSemanticAliasMatch(candidate: string, anchorText: string): boolean {
  const normalizedCandidate = normalizeAliasValue(candidate);
  const normalizedAnchor = normalizeAliasValue(anchorText);

  if (!normalizedCandidate || !normalizedAnchor) {
    return false;
  }

  if (normalizedCandidate === normalizedAnchor) {
    return true;
  }

  if (
    normalizedCandidate.includes(normalizedAnchor) ||
    normalizedAnchor.includes(normalizedCandidate)
  ) {
    return true;
  }

  const sharedTokenCount = countSharedTokens(normalizedCandidate, normalizedAnchor);
  const anchorTokenCount = normalizedAnchor.split(" ").filter(Boolean).length;

  return anchorTokenCount > 0 && sharedTokenCount / anchorTokenCount >= 0.7;
}

export function findMatchingAlias(candidates: string[], anchorText: string): string {
  const normalizedAnchor = normalizeAliasValue(anchorText);
  let bestCandidate = candidates[0] ?? anchorText;
  let bestScore = -1;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeAliasValue(candidate);

    if (normalizedCandidate === normalizedAnchor) {
      return candidate;
    }

    let score = 0;
    if (normalizedCandidate && normalizedAnchor) {
      if (normalizedCandidate.includes(normalizedAnchor) || normalizedAnchor.includes(normalizedCandidate)) {
        score = 0.9;
      } else {
        const sharedTokenCount = countSharedTokens(normalizedCandidate, normalizedAnchor);
        const anchorTokenCount = normalizedAnchor.split(" ").filter(Boolean).length;
        const candidateTokenCount = normalizedCandidate.split(" ").filter(Boolean).length;
        const coverage = anchorTokenCount > 0 ? sharedTokenCount / anchorTokenCount : 0;
        const precision = candidateTokenCount > 0 ? sharedTokenCount / candidateTokenCount : 0;
        score = coverage * 0.7 + precision * 0.3;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}
