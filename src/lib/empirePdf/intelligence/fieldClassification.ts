import type { PdfDiscoveredField, PdfFieldClassification } from "./types";

export function classifyDiscoveredField(field: PdfDiscoveredField): PdfFieldClassification {
  if (field.kind === "checkbox") {
    return "checkbox_control";
  }

  if (field.kind === "signature") {
    return "signature_zone";
  }

  if (field.kind === "static_label") {
    return "static_reference";
  }

  if (field.kind === "table") {
    return "table_boundary";
  }

  if (field.kind === "reserved_area") {
    return "reserved_area";
  }

  if (field.kind === "text") {
    return "business_data";
  }

  return "unknown";
}

export function classifyDiscoveredFields(fields: PdfDiscoveredField[]): PdfDiscoveredField[] {
  return fields.map((field) => ({
    ...field,
    classification: field.classification ?? classifyDiscoveredField(field),
  }));
}
