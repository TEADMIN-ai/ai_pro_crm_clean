export type VehicleFinanceTextQualityFlag = "SHORT_TEXT" | "CORRUPTED_TEXT" | "LOW_CONFIDENCE" | "UNUSABLE_TEXT";

export type VehicleFinanceTextQualityAssessment = {
  textLength: number;
  corruptedCharacterCount: number;
  corruptedCharacterRatio: number;
  confidence: number;
  confidenceThreshold: number;
  usable: boolean;
  shouldRunOcrFallback: boolean;
  flags: VehicleFinanceTextQualityFlag[];
  reasons: string[];
};

type TextQualityOptions = {
  confidence?: number;
  confidenceThreshold?: number;
  minTextLength?: number;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function assessVehicleFinanceTextQuality(
  extractedText: string,
  options?: TextQualityOptions,
): VehicleFinanceTextQualityAssessment {
  const normalizedText = typeof extractedText === "string" ? extractedText : "";
  const textLength = normalizedText.length;
  const minTextLength = options?.minTextLength ?? 300;
  const confidenceThreshold = options?.confidenceThreshold ?? 70;
  const baseConfidence = clamp(typeof options?.confidence === "number" ? options.confidence : Math.max(0, 100 - Math.max(0, minTextLength - textLength) / 3));
  const corruptedCharacterCount = (normalizedText.match(/[�\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  const corruptedCharacterRatio = textLength > 0 ? corruptedCharacterCount / textLength : 0;
  const hasCorruption = corruptedCharacterCount > 0 || corruptedCharacterRatio > 0.02 || /[^\x09\x0A\x0D\x20-\x7E]/.test(normalizedText.slice(0, Math.min(1000, textLength)));
  const isShort = textLength < minTextLength;
  const usable = !isShort && !hasCorruption && baseConfidence >= confidenceThreshold;
  const flags: VehicleFinanceTextQualityFlag[] = [];
  const reasons: string[] = [];

  if (isShort) {
    flags.push("SHORT_TEXT");
    reasons.push(`Text length ${textLength} below threshold ${minTextLength}`);
  }

  if (hasCorruption) {
    flags.push("CORRUPTED_TEXT");
    reasons.push("Corrupted characters or unusable symbols detected");
  }

  if (baseConfidence < confidenceThreshold) {
    flags.push("LOW_CONFIDENCE");
    reasons.push(`Confidence ${baseConfidence} below threshold ${confidenceThreshold}`);
  }

  if (!usable) {
    flags.push("UNUSABLE_TEXT");
    reasons.push("Text is not reliable enough for downstream extraction");
  }

  return {
    textLength,
    corruptedCharacterCount,
    corruptedCharacterRatio,
    confidence: baseConfidence,
    confidenceThreshold,
    usable,
    shouldRunOcrFallback: !usable,
    flags: Array.from(new Set(flags)),
    reasons,
  };
}
