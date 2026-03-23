type SuggestionDocument = {
  id?: string | number;
  name?: string;
  documentName?: string;
  fileName?: string;
  verified?: boolean;
};

type FixSuggestion = {
  id: string | number;
  title: string;
  suggestion: string;
  severity: "warning";
};

export function generateFixSuggestions(documents: SuggestionDocument[] = []): FixSuggestion[] {
  const issues = documents.filter((d) => d?.verified !== true);

  return issues.map((doc) => {
    const name = doc?.name || doc?.documentName || doc?.fileName || "Document";

    return {
      id: doc?.id || name,
      title: `${name} needs attention`,
      suggestion: `Please review and upload a valid ${name}. Ensure it is signed, up to date, and clearly legible.`,
      severity: "warning",
    };
  });
}
