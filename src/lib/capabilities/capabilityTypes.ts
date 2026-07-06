import type { UserRole } from '@/lib/auth/roleUtils';
import type { WorkspaceSummary, WorkspaceType } from '@/lib/workspaces/workspaceTypes';


export const CAPABILITY_KEYS = Object.freeze({
  VEHICLE_FINANCE_VIEW: 'vehicleFinance.view',
  VEHICLE_FINANCE_CREATE: 'vehicleFinance.create',
  VEHICLE_FINANCE_EDIT: 'vehicleFinance.edit',
  VEHICLE_FINANCE_DELETE: 'vehicleFinance.delete',
  CONTRACTORS_VIEW: 'contractors.view',
  CONTRACTORS_MANAGE: 'contractors.manage',
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_VERIFY: 'documents.verify',
  DOCUMENTS_SIGN: 'documents.sign',
  TENDERS_VIEW: 'tenders.view',
  TENDERS_SUBMIT: 'tenders.submit',
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_ADMIN: 'dashboard.admin',
  WORKSPACE_MANAGE: 'workspace.manage',
  SETTINGS_MANAGE: 'settings.manage',
} as const);

export type CapabilityKey = (typeof CAPABILITY_KEYS)[keyof typeof CAPABILITY_KEYS];

export const CAPABILITY_KEY_LIST = Object.freeze(Object.values(CAPABILITY_KEYS) as CapabilityKey[]);

export interface CapabilityDefinition {
  key: CapabilityKey;
  label: string;
  description: string;
  defaultRoles: readonly UserRole[];
  workspaceTypes?: readonly WorkspaceType[];
  ownerGranted?: boolean;
}

export interface CapabilitySubject {
  uid?: string;
  role?: UserRole | null;
  workspace?: WorkspaceSummary | null;
  workspaceOwnerId?: string;
  workspaceType?: WorkspaceType | null;
  capabilities?: readonly unknown[];
}

const capabilityKeySet = new Set<CapabilityKey>(CAPABILITY_KEY_LIST);

export function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === 'string' && capabilityKeySet.has(value as CapabilityKey);
}

export function normalizeCapabilityKey(value: unknown): CapabilityKey | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return isCapabilityKey(trimmed) ? trimmed : null;
}

export function normalizeCapabilityKeys(value: unknown): readonly CapabilityKey[] {
  if (!Array.isArray(value)) {
    return Object.freeze([] as CapabilityKey[]);
  }

  const normalized = value
    .map((item) => normalizeCapabilityKey(item))
    .filter((item): item is CapabilityKey => item !== null);

  return Object.freeze([...new Set(normalized)] as CapabilityKey[]);
}

export function toCapabilitySet(capabilities: readonly CapabilityKey[]): ReadonlySet<CapabilityKey> {
  return new Set(capabilities);
}
