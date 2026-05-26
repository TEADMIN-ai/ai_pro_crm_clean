export type AutomationAlertType = "CRITICAL" | "WARNING" | "ERROR";
export type AutomationAlertCode =
  | "BLOCKED_CONTRACTOR"
  | "MISSING_DOCUMENTS"
  | "AI_FAILED"
  | "AI_PENDING_TIMEOUT";

export type AutomationAlert = {
  type: AutomationAlertType;
  code: AutomationAlertCode;
  message: string;
};

export type AutomationContractor = {
  id?: string;
  contractorId?: string;
  name?: string | null;
  readinessStatus?: string | null;
  missingDocsCount?: number | null;
  aiStatusSummary?: string | null;
  aiStatusPendingSince?: number | string | Date | null;
};

const PENDING_AI_ALERT_THRESHOLD_MS = 1000 * 60 * 60;

function toName(contractor: AutomationContractor): string {
  return typeof contractor.name === "string" && contractor.name.trim().length > 0
    ? contractor.name.trim()
    : "Contractor";
}

function toPendingTimestamp(value: AutomationContractor["aiStatusPendingSince"]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return null;
}

export async function runAutomation(contractor: AutomationContractor): Promise<AutomationAlert[]> {
  const alerts: AutomationAlert[] = [];
  const contractorName = toName(contractor);
  const readinessStatus = typeof contractor.readinessStatus === "string"
    ? contractor.readinessStatus.trim().toUpperCase()
    : "";
  const aiStatusSummary = typeof contractor.aiStatusSummary === "string"
    ? contractor.aiStatusSummary.trim().toLowerCase()
    : "";
  const missingDocsCount =
    typeof contractor.missingDocsCount === "number" && Number.isFinite(contractor.missingDocsCount)
      ? Math.max(0, contractor.missingDocsCount)
      : 0;

  if (readinessStatus === "BLOCKED") {
    alerts.push({
      type: "CRITICAL",
      code: "BLOCKED_CONTRACTOR",
      message: `${contractorName} is BLOCKED and requires immediate action`,
    });
  }

  if (missingDocsCount > 0) {
    alerts.push({
      type: "WARNING",
      code: "MISSING_DOCUMENTS",
      message: `${contractorName} has ${missingDocsCount} missing documents`,
    });
  }

  if (aiStatusSummary === "failed") {
    alerts.push({
      type: "ERROR",
      code: "AI_FAILED",
      message: `AI validation failed for ${contractorName}`,
    });
  }

  if (aiStatusSummary === "pending") {
    const pendingSince = toPendingTimestamp(contractor.aiStatusPendingSince);

    if (pendingSince !== null && Date.now() - pendingSince > PENDING_AI_ALERT_THRESHOLD_MS) {
      alerts.push({
        type: "WARNING",
        code: "AI_PENDING_TIMEOUT",
        message: `AI validation has been pending too long for ${contractorName}`,
      });
    }
  }

  return alerts;
}
