import type { UserRole } from "@/lib/auth/roleUtils";
import type { ManusContext } from "@/lib/manus/types/manus.types";

const TOOL_PERMISSIONS: Record<string, UserRole[]> = {
  firestoreTool: ["admin", "manager", "staff", "contractor", "auditor", "viewer"],
  openaiTool: ["admin", "manager", "staff", "contractor"],
  pdfTool: ["admin", "manager", "staff", "contractor"],
  emailTool: ["admin", "manager", "staff"],
  dashboardTool: ["admin", "manager", "staff"],
  complianceTool: ["admin", "manager", "staff", "contractor"],
  contractorTool: ["admin", "manager", "staff", "contractor"],
};

export class ManusPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManusPermissionError";
  }
}

export function assertRoleAllowed(role: UserRole, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(role)) {
    throw new ManusPermissionError(`Role '${role}' is not permitted for this action`);
  }
}

export function assertToolAccess(context: ManusContext, toolName: string) {
  const allowed = TOOL_PERMISSIONS[toolName];

  if (!allowed) {
    throw new ManusPermissionError(`Tool '${toolName}' is not registered`);
  }

  assertRoleAllowed(context.actor.role, allowed);
}

export function assertContractorIsolation(context: ManusContext, targetContractorId?: string) {
  if (!targetContractorId) {
    return;
  }

  if (context.actor.role !== "contractor") {
    return;
  }

  if (!context.actor.contractorId || context.actor.contractorId !== targetContractorId) {
    throw new ManusPermissionError("Contractor isolation violation");
  }
}
