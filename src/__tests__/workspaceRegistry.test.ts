import { describe, expect, test } from '@jest/globals';
import { getWorkspaceById, getWorkspaceBySlug, getWorkspaceRegistry, validateWorkspaceRecord } from '@/lib/workspaces/workspaceRegistry';
import { resolveWorkspace, resolveWorkspaceById, resolveWorkspaceBySlug, WorkspaceResolutionError } from '@/lib/workspaces/workspaceResolver';
import { canAccessWorkspace, canManageWorkspace, isWorkspaceOwner } from '@/lib/workspaces/workspacePermissions';

describe('workspace registry', () => {
  test('loads the canonical workspace registry and validates record shape', () => {
    const registry = getWorkspaceRegistry();

    expect(registry).toHaveLength(8);
    expect(validateWorkspaceRecord(registry[0])).toBe(registry[0]);
    expect(getWorkspaceById('0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9001')?.displayName).toBe('Torque Empire');
    expect(getWorkspaceBySlug('roar-cars')?.type).toBe('ROAR_CARS');
  });

  test('resolves workspaces by id, slug, and canonical payload', () => {
    expect(resolveWorkspaceById('0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9002')).toEqual({
      id: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9002',
      slug: 'roar-cars',
      displayName: 'Roar Cars SA',
      type: 'ROAR_CARS',
      status: 'ACTIVE',
    });

    expect(resolveWorkspaceBySlug('hygiene')).toEqual({
      id: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9003',
      slug: 'hygiene',
      displayName: 'Torque Empire Hygiene',
      type: 'HYGIENE',
      status: 'ACTIVE',
    });

    expect(
      resolveWorkspace({
        workspace: {
          id: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9004',
          slug: 'procurement',
          displayName: 'Torque Empire Procurement',
          type: 'PROCUREMENT',
          status: 'ACTIVE',
        },
      })
    ).toEqual({
      id: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9004',
      slug: 'procurement',
      displayName: 'Torque Empire Procurement',
      type: 'PROCUREMENT',
      status: 'ACTIVE',
    });
  });

  test('rejects blank, unknown, and archived workspace identifiers', () => {
    expect(() => resolveWorkspace({ workspaceId: '' })).toThrow(WorkspaceResolutionError);
    expect(() => resolveWorkspaceById('ffffffff-ffff-ffff-ffff-ffffffffffff')).toThrow('Unknown workspace');
    expect(() =>
      resolveWorkspace({
        workspace: {
          id: '0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9001',
          slug: 'torque-empire',
          displayName: 'Torque Empire',
          type: 'TORQUE_EMPIRE',
          status: 'ARCHIVED',
        },
      })
    ).toThrow('Archived workspace is not allowed');
  });

  test('supports access and management helpers', () => {
    const workspace = getWorkspaceBySlug('roar-cars');

    expect(workspace).not.toBeNull();
    expect(isWorkspaceOwner({ uid: 'system' }, workspace!)).toBe(true);
    expect(canAccessWorkspace({ role: 'staff', workspaceId: workspace!.workspaceId }, workspace!)).toBe(true);
    expect(canManageWorkspace({ role: 'manager' }, workspace!)).toBe(true);
    expect(canAccessWorkspace({ role: 'viewer', workspaceId: workspace!.workspaceId }, workspace!)).toBe(true);
    expect(canAccessWorkspace({ role: 'viewer' }, { ...workspace!, status: 'ARCHIVED' })).toBe(false);
    expect(canManageWorkspace({ role: 'viewer' }, workspace!)).toBe(false);
  });
});

