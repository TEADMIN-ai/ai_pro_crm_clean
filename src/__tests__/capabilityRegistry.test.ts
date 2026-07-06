import { describe, expect, test } from '@jest/globals';
import { CAPABILITY_KEYS, type CapabilityDefinition } from '@/lib/capabilities/capabilityTypes';
import { getCapability, getCapabilityRegistry, validateCapabilityRegistry } from '@/lib/capabilities/capabilityRegistry';
import { canAccessFeature, hasAllCapabilities, hasAnyCapability, hasCapability, resolveCapabilities } from '@/lib/capabilities/capabilityResolver';

describe('capability registry', () => {
  test('loads the canonical registry and resolves capabilities by key', () => {
    const registry = getCapabilityRegistry();
    expect(registry).toHaveLength(15);
    expect(getCapability(CAPABILITY_KEYS.DASHBOARD_VIEW)?.label).toBe('Dashboard View');
    expect(getCapability('unknown.capability')).toBeNull();
  });

  test('resolves role, workspace, and explicit capability access', () => {
    const capabilities = resolveCapabilities({ role: 'viewer', uid: 'owner-1', workspaceOwnerId: 'owner-1', workspace: { id: '00000000-0000-0000-0000-000000000001', slug: 'roar-cars', displayName: 'Roar Cars SA', type: 'ROAR_CARS', status: 'ACTIVE' } });
    expect(hasCapability({ role: 'viewer' }, CAPABILITY_KEYS.DASHBOARD_VIEW)).toBe(true);
    expect(hasAnyCapability({ role: 'viewer' }, [CAPABILITY_KEYS.DASHBOARD_VIEW, 'not-a-capability'])).toBe(true);
    expect(hasAllCapabilities({ role: 'viewer' }, [CAPABILITY_KEYS.DASHBOARD_VIEW, CAPABILITY_KEYS.CONTRACTORS_VIEW])).toBe(true);
    expect(canAccessFeature({ role: 'viewer', uid: 'owner-1', workspaceOwnerId: 'owner-1' }, [CAPABILITY_KEYS.WORKSPACE_MANAGE, CAPABILITY_KEYS.DASHBOARD_ADMIN])).toBe(true);
    expect(capabilities).toContain(CAPABILITY_KEYS.WORKSPACE_MANAGE);
  });

  test('rejects duplicate capability keys in registry validation', () => {
    const sample: CapabilityDefinition[] = [{ key: CAPABILITY_KEYS.DASHBOARD_VIEW, label: 'One', description: 'One', defaultRoles: ['admin'] }, { key: CAPABILITY_KEYS.DASHBOARD_VIEW, label: 'Two', description: 'Two', defaultRoles: ['manager'] }];
    expect(() => validateCapabilityRegistry(sample)).toThrow('Duplicate capability key: dashboard.view');
  });
});
