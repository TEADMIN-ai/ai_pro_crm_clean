import type { EngineDebugField } from "../templates";

export type EmpirePdfVisualDriftEvent = {
  fieldKey: string;
  type: "missing_candidate" | "new_candidate" | "coordinate_shift" | "font_size_change" | "dimension_change";
  severity: "low" | "medium" | "high";
  message: string;
  delta: number;
};

export type EmpirePdfVisualRegressionReport = {
  baselineFieldCount: number;
  candidateFieldCount: number;
  driftScore: number;
  driftEvents: EmpirePdfVisualDriftEvent[];
};

function renderedX(field: EngineDebugField) {
  return field.renderedBounds?.x ?? field.x;
}

function renderedY(field: EngineDebugField) {
  return field.renderedBounds?.y ?? field.y;
}

function renderedWidth(field: EngineDebugField) {
  return field.renderedBounds?.width ?? field.width ?? 0;
}

function renderedHeight(field: EngineDebugField) {
  return field.renderedBounds?.height ?? field.height ?? 0;
}

function severityFromDelta(delta: number, mediumThreshold: number, highThreshold: number): EmpirePdfVisualDriftEvent["severity"] {
  if (delta >= highThreshold) {
    return "high";
  }

  if (delta >= mediumThreshold) {
    return "medium";
  }

  return "low";
}

export function compareEmpirePdfVisualLayout(params: {
  baseline: EngineDebugField[];
  candidate: EngineDebugField[];
  coordinateTolerance?: number;
  fontTolerance?: number;
  dimensionTolerance?: number;
}): EmpirePdfVisualRegressionReport {
  const coordinateTolerance = params.coordinateTolerance ?? 0.75;
  const fontTolerance = params.fontTolerance ?? 0.25;
  const dimensionTolerance = params.dimensionTolerance ?? 0.75;
  const baselineByKey = new Map(params.baseline.map((field) => [field.fieldKey, field]));
  const candidateByKey = new Map(params.candidate.map((field) => [field.fieldKey, field]));
  const driftEvents: EmpirePdfVisualDriftEvent[] = [];

  for (const [fieldKey, baseline] of baselineByKey) {
    const candidate = candidateByKey.get(fieldKey);

    if (!candidate) {
      driftEvents.push({
        fieldKey,
        type: "missing_candidate",
        severity: "high",
        message: `${fieldKey} is missing from candidate render`,
        delta: 100,
      });
      continue;
    }

    const coordinateDelta = Math.max(
      Math.abs(renderedX(candidate) - renderedX(baseline)),
      Math.abs(renderedY(candidate) - renderedY(baseline))
    );
    if (coordinateDelta > coordinateTolerance) {
      driftEvents.push({
        fieldKey,
        type: "coordinate_shift",
        severity: severityFromDelta(coordinateDelta, 2, 5),
        message: `${fieldKey} shifted by ${coordinateDelta.toFixed(2)}pt`,
        delta: Number(coordinateDelta.toFixed(2)),
      });
    }

    const fontDelta = Math.abs(candidate.fontSize - baseline.fontSize);
    if (fontDelta > fontTolerance) {
      driftEvents.push({
        fieldKey,
        type: "font_size_change",
        severity: severityFromDelta(fontDelta, 0.75, 1.5),
        message: `${fieldKey} font size changed by ${fontDelta.toFixed(2)}pt`,
        delta: Number(fontDelta.toFixed(2)),
      });
    }

    const dimensionDelta = Math.max(
      Math.abs(renderedWidth(candidate) - renderedWidth(baseline)),
      Math.abs(renderedHeight(candidate) - renderedHeight(baseline))
    );
    if (dimensionDelta > dimensionTolerance) {
      driftEvents.push({
        fieldKey,
        type: "dimension_change",
        severity: severityFromDelta(dimensionDelta, 2, 5),
        message: `${fieldKey} rendered dimensions changed by ${dimensionDelta.toFixed(2)}pt`,
        delta: Number(dimensionDelta.toFixed(2)),
      });
    }
  }

  for (const fieldKey of candidateByKey.keys()) {
    if (!baselineByKey.has(fieldKey)) {
      driftEvents.push({
        fieldKey,
        type: "new_candidate",
        severity: "medium",
        message: `${fieldKey} is new in candidate render`,
        delta: 50,
      });
    }
  }

  const severityWeight = driftEvents.reduce((sum, event) => {
    if (event.severity === "high") {
      return sum + 8;
    }

    if (event.severity === "medium") {
      return sum + 4;
    }

    return sum + 1;
  }, 0);

  return {
    baselineFieldCount: params.baseline.length,
    candidateFieldCount: params.candidate.length,
    driftScore: Math.max(0, 100 - severityWeight),
    driftEvents,
  };
}
