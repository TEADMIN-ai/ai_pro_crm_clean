export function analyzeTenderText(text: string) {
  const lower = text.toLowerCase();

  const requirements = {
    taxClearance: lower.includes("tax clearance"),
    bbbee: lower.includes("bbbee"),
    cipc: lower.includes("cipc"),
    coida: lower.includes("coida"),
  };

  const missing = Object.entries(requirements)
    .filter(([, present]) => !present)
    .map(([key]) => key);

  const score =
    (Object.values(requirements).filter(Boolean).length /
      Object.keys(requirements).length) *
    100;

  let risk = "LOW";
  if (score < 80) risk = "MEDIUM";
  if (score < 60) risk = "HIGH";

  return {
    requirements,
    missing,
    score,
    risk,
  };
}
