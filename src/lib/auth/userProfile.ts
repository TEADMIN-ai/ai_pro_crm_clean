import type { User as FirebaseUser } from 'firebase/auth';
import type { UserRole } from '@/lib/auth/roleUtils';
import { normalizeWorkspaceSummary, type WorkspaceSummary } from '@/lib/workspaces/workspaceTypes';
import { normalizeCapabilityKeys, type CapabilityKey } from '@/lib/capabilities/capabilityTypes';

export type AuthUser = FirebaseUser & UserProfile;

export interface UserProfile {
  name?: string;
  email?: string;
  role: UserRole;
  roleRaw?: unknown;
  status?: string;
  company?: string;
  contractorId?: string;
  workspaceId?: string;
  workspaceSlug?: string;
  workspace?: WorkspaceSummary | null;
  capabilities?: readonly CapabilityKey[];
  createdAt?: unknown;
}

const VALID_ROLES: readonly UserRole[] = [
  'admin',
  'manager',
  'staff',
  'driver',
  'contractor',
  'auditor',
  'viewer',
  'dealerPilot',
  'vehicleFinanceStaff',
  'ROAR_CARS_STAFF',
  'guest',
] as const;

const ROLE_ALIASES: Record<string, UserRole> = {
  administrator: 'admin',
  dealerpilot: 'dealerPilot',
  dealer_pilot: 'dealerPilot',
  vehiclefinancestaff: 'vehicleFinanceStaff',
  vehicle_finance_staff: 'vehicleFinanceStaff',
  roar_cars_staff: 'ROAR_CARS_STAFF',
  roarcarsstaff: 'ROAR_CARS_STAFF',
};

const WORKSPACE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeRole(value: unknown): UserRole {
  if (typeof value !== 'string') {
    return 'guest';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 'guest';
  }

  if (VALID_ROLES.includes(trimmed as UserRole)) {
    return trimmed as UserRole;
  }

  const aliasKey = trimmed.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
  return ROLE_ALIASES[aliasKey] ?? ROLE_ALIASES[aliasKey.replace(/_/g, '')] ?? 'guest';
}

export function resolveRole(primary: unknown, fallback?: unknown): UserRole {
  const normalizedPrimary = normalizeRole(primary);
  return normalizedPrimary !== 'guest' ? normalizedPrimary : normalizeRole(fallback);
}

export function normalizeCapabilityList(value: unknown): readonly CapabilityKey[] {
  return normalizeCapabilityKeys(value);
}

export function normalizeContractorId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveWorkspaceId(primary?: unknown, fallback?: unknown): string | undefined {
  if (typeof primary === 'string' && WORKSPACE_ID_PATTERN.test(primary.trim())) {
    return primary.trim().toLowerCase();
  }

  if (typeof fallback === 'string' && WORKSPACE_ID_PATTERN.test(fallback.trim())) {
    return fallback.trim().toLowerCase();
  }

  return undefined;
}

export function buildUserProfile(data: Record<string, unknown>): UserProfile {
  const workspace = normalizeWorkspaceSummary(data.workspace);
  const role = resolveRole(data.role, data.roleRaw ?? data.roleAlias);

  return {
    name: typeof data.name === 'string' ? data.name : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
    role,
    roleRaw: data.role,
    status: typeof data.status === 'string' ? data.status : undefined,
    company: typeof data.company === 'string' ? data.company : undefined,
    contractorId: normalizeContractorId(data.contractorId),
    workspaceId: resolveWorkspaceId(data.workspaceId, workspace?.id),
    workspaceSlug: typeof data.workspaceSlug === 'string' ? data.workspaceSlug : undefined,
    workspace,
    capabilities: normalizeCapabilityList(data.capabilities),
    createdAt: data.createdAt,
  };
}
