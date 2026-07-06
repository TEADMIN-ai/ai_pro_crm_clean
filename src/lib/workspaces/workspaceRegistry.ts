import { WORKSPACE_STATUSES, type Workspace, type WorkspaceSummary, toWorkspaceSummary } from './workspaceTypes';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORKSPACE_DATA: Workspace[] = [
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9001', slug: 'torque-empire', name: 'Torque Empire', displayName: 'Torque Empire', type: 'TORQUE_EMPIRE', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9002', slug: 'roar-cars', name: 'Roar Cars SA', displayName: 'Roar Cars SA', type: 'ROAR_CARS', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9003', slug: 'hygiene', name: 'Torque Empire Hygiene', displayName: 'Torque Empire Hygiene', type: 'HYGIENE', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9004', slug: 'procurement', name: 'Torque Empire Procurement', displayName: 'Torque Empire Procurement', type: 'PROCUREMENT', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9005', slug: 'client', name: 'Client Workspace', displayName: 'Client Workspace', type: 'CLIENT', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9006', slug: 'partner', name: 'Partner Workspace', displayName: 'Partner Workspace', type: 'PARTNER', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9007', slug: 'internal', name: 'Internal Workspace', displayName: 'Internal Workspace', type: 'INTERNAL', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
  { workspaceId: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9008', slug: 'development', name: 'Development Workspace', displayName: 'Development Workspace', type: 'DEVELOPMENT', status: 'ACTIVE', ownerId: 'system', createdAt: '2026-07-06T00:00:00.000Z', updatedAt: '2026-07-06T00:00:00.000Z' },
];
const registryById = new Map(WORKSPACE_DATA.map((workspace) => [workspace.workspaceId.toLowerCase(), workspace] as const));
const registryBySlug = new Map(WORKSPACE_DATA.map((workspace) => [workspace.slug.toLowerCase(), workspace] as const));
export const getWorkspaceRegistry = (): Workspace[] => WORKSPACE_DATA.map((workspace) => ({ ...workspace }));
export const listWorkspaces = (): WorkspaceSummary[] => WORKSPACE_DATA.map(toWorkspaceSummary);
export const isValidWorkspaceId = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value.trim());
export const normalizeWorkspaceId = (value: unknown): string | null => isValidWorkspaceId(value) ? value.trim().toLowerCase() : null;
export const getWorkspaceById = (workspaceId: unknown): Workspace | null => { const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId); return normalizedWorkspaceId ? registryById.get(normalizedWorkspaceId) ?? null : null; };
export const getWorkspaceBySlug = (slug: unknown): Workspace | null => { if (typeof slug !== 'string' || slug.trim().length === 0) return null; return registryBySlug.get(slug.trim().toLowerCase()) ?? null; };
export const getWorkspaceByIdentifier = (value: unknown): Workspace | null => getWorkspaceById(value) ?? getWorkspaceBySlug(value);
export const validateWorkspaceRecord = (workspace: Workspace): Workspace => { if (!isValidWorkspaceId(workspace.workspaceId)) throw new Error('Invalid workspace id'); if (!workspace.slug.trim()) throw new Error('Invalid workspace slug'); if (!workspace.name.trim()) throw new Error('Invalid workspace name'); if (!workspace.displayName.trim()) throw new Error('Invalid workspace displayName'); if (!WORKSPACE_STATUSES.includes(workspace.status)) throw new Error('Invalid workspace status'); return workspace; };
export const isWorkspaceArchived = (workspace: Workspace | WorkspaceSummary | null | undefined): boolean => workspace?.status === 'ARCHIVED';
export const isWorkspaceActive = (workspace: Workspace | WorkspaceSummary | null | undefined): boolean => workspace?.status === 'ACTIVE';
export const toWorkspaceRegistrySummary = (workspace: Workspace | null | undefined): WorkspaceSummary | null => workspace ? toWorkspaceSummary(workspace) : null;
