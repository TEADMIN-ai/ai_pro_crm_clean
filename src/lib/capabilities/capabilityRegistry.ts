import { CAPABILITY_KEYS, type CapabilityDefinition, type CapabilityKey, normalizeCapabilityKey } from './capabilityTypes';

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  { key: CAPABILITY_KEYS.VEHICLE_FINANCE_VIEW, label: 'Vehicle Finance View', description: 'View vehicle finance applications, customers, and dashboards.', defaultRoles: ['admin', 'manager', 'staff', 'dealerPilot', 'vehicleFinanceStaff', 'ROAR_CARS_STAFF'] },
  { key: CAPABILITY_KEYS.VEHICLE_FINANCE_CREATE, label: 'Vehicle Finance Create', description: 'Create new vehicle finance applications and supporting records.', defaultRoles: ['admin', 'manager', 'staff', 'vehicleFinanceStaff', 'ROAR_CARS_STAFF'] },
  { key: CAPABILITY_KEYS.VEHICLE_FINANCE_EDIT, label: 'Vehicle Finance Edit', description: 'Edit vehicle finance applications and operational records.', defaultRoles: ['admin', 'manager', 'staff', 'vehicleFinanceStaff', 'ROAR_CARS_STAFF'] },
  { key: CAPABILITY_KEYS.VEHICLE_FINANCE_DELETE, label: 'Vehicle Finance Delete', description: 'Delete vehicle finance records where operational policy allows.', defaultRoles: ['admin', 'manager', 'staff', 'vehicleFinanceStaff', 'ROAR_CARS_STAFF'] },
  { key: CAPABILITY_KEYS.CONTRACTORS_VIEW, label: 'Contractors View', description: 'View contractor records, documents, and profiles.', defaultRoles: ['admin', 'manager', 'staff', 'contractor', 'auditor', 'viewer'] },
  { key: CAPABILITY_KEYS.CONTRACTORS_MANAGE, label: 'Contractors Manage', description: 'Manage contractor records, onboarding, and profile workflows.', defaultRoles: ['admin', 'manager', 'staff'] },
  { key: CAPABILITY_KEYS.DOCUMENTS_UPLOAD, label: 'Documents Upload', description: 'Upload documents into the platform.', defaultRoles: ['admin', 'manager', 'staff', 'contractor'] },
  { key: CAPABILITY_KEYS.DOCUMENTS_VERIFY, label: 'Documents Verify', description: 'Verify document authenticity and completeness.', defaultRoles: ['admin', 'manager', 'staff', 'auditor'] },
  { key: CAPABILITY_KEYS.DOCUMENTS_SIGN, label: 'Documents Sign', description: 'Sign documents and approvals where workflow allows.', defaultRoles: ['admin', 'manager', 'staff', 'contractor'] },
  { key: CAPABILITY_KEYS.TENDERS_VIEW, label: 'Tenders View', description: 'View tender records and tender workspace data.', defaultRoles: ['admin', 'manager', 'staff', 'auditor', 'viewer'] },
  { key: CAPABILITY_KEYS.TENDERS_SUBMIT, label: 'Tenders Submit', description: 'Submit tenders and tender responses.', defaultRoles: ['admin', 'manager', 'staff'] },
  { key: CAPABILITY_KEYS.DASHBOARD_VIEW, label: 'Dashboard View', description: 'View the operational dashboard and workspace summary.', defaultRoles: ['admin', 'manager', 'staff', 'driver', 'contractor', 'auditor', 'viewer', 'dealerPilot', 'vehicleFinanceStaff', 'ROAR_CARS_STAFF'] },
  { key: CAPABILITY_KEYS.DASHBOARD_ADMIN, label: 'Dashboard Admin', description: 'Access administrator-level dashboard functions.', defaultRoles: ['admin'] },
  { key: CAPABILITY_KEYS.WORKSPACE_MANAGE, label: 'Workspace Manage', description: 'Manage workspace configuration and ownership.', defaultRoles: ['admin', 'manager'], ownerGranted: true },
  { key: CAPABILITY_KEYS.SETTINGS_MANAGE, label: 'Settings Manage', description: 'Manage platform and workspace settings.', defaultRoles: ['admin', 'manager'] },
] as const;

function freezeDefinition(definition: CapabilityDefinition): CapabilityDefinition {
  return Object.freeze({ ...definition, defaultRoles: Object.freeze([...definition.defaultRoles]), workspaceTypes: definition.workspaceTypes ? Object.freeze([...definition.workspaceTypes]) : undefined });
}

export function validateCapabilityRegistry(entries: readonly CapabilityDefinition[]): readonly CapabilityDefinition[] {
  const seen = new Set<CapabilityKey>();
  return Object.freeze(entries.map((entry) => {
    if (seen.has(entry.key)) {
      throw new Error('Duplicate capability key: ' + entry.key);
    }
    seen.add(entry.key);
    return freezeDefinition(entry);
  }));
}

const CAPABILITY_REGISTRY = validateCapabilityRegistry(CAPABILITY_DEFINITIONS);

export function getCapabilityRegistry(): readonly CapabilityDefinition[] {
  return CAPABILITY_REGISTRY;
}

export function getCapability(key: unknown): CapabilityDefinition | null {
  const normalizedKey = normalizeCapabilityKey(key);
  if (!normalizedKey) {
    return null;
  }
  return CAPABILITY_REGISTRY.find((definition) => definition.key === normalizedKey) ?? null;
}

