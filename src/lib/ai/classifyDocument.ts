import OpenAI from "openai";

const DEFAULT_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

export type DocumentClassification = {
  docType: string | null;
};

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function fallbackTypeFromFileName(fileName?: string): string | null {
  const value = (fileName ?? "").toLowerCase();
  if (!value) return null;
  if (value.includes("insurance") || value.includes("coi")) return "insurance_certificate";
  if (value.includes("license")) return "license";
  if (value.includes("permit")) return "permit";
  if (value.includes("contract") || value.includes("agreement")) return "contract";
  if (value.includes("tax") || value.includes("w9") || value.includes("w-9")) return "tax_document";
  if (value.includes("id") || value.includes("passport") || value.includes("driver")) return "id_document";
  if (value.includes("safety") || value.includes("osha")) return "safety_certificate";
  return null;
}

export async function classifyDocument(input: {
  text?: string;
  fileName?: string;
}): Promise<DocumentClassification> {
  const trimmedText = input.text?.trim() ?? "";
  const fallback = fallbackTypeFromFileName(input.fileName);

  if (trimmedText.length === 0) {
    return { docType: fallback };
  }

  const client = getOpenAIClient();
  if (!client) {
    return { docType: fallback };
  }

  try {
    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "document_classification",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              docType: {
                type: ["string", "null"],
                enum: [
                  "insurance_certificate",
                  "license",
                  "permit",
                  "contract",
                  "tax_document",
                  "id_document",
                  "safety_certificate",
                  "other",
                  null,
                ],
              },
            },
            required: ["docType"],
          },
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Classify contractor compliance documents by primary type. " +
                "If unclear, return other or null.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `File name: ${input.fileName ?? "unknown"}\n\n` +
                `Document text:\n${trimmedText.slice(0, 12000)}`,
            },
          ],
        },
      ],
    });

    if (!response.output_text) {
      return { docType: fallback };
    }

    const parsed = JSON.parse(response.output_text) as { docType?: unknown };
    const parsedDocType = typeof parsed.docType === "string" ? parsed.docType : null;

    return { docType: parsedDocType ?? fallback };
  } catch {
    return { docType: fallback };
  }
}
