export class DocumentExecutionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DocumentExecutionError";
    this.status = status;
  }
}

const ALLOWED_ROLES = new Set(["admin", "manager", "staff", "contractor"]);

export function guardDocumentExecution(params: {
  exists: boolean;
  role: string;
  url: string;
}): void {
  if (!ALLOWED_ROLES.has(params.role)) {
    throw new DocumentExecutionError("Forbidden", 403);
  }

  if (!params.exists) {
    throw new DocumentExecutionError("Document not found", 404);
  }

  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch {
    throw new DocumentExecutionError("Invalid document URL", 422);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new DocumentExecutionError("Invalid document URL protocol", 422);
  }
}
