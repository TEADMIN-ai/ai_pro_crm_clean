import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import type { UserRole } from '@/lib/auth/roleUtils';
import { type AuthUser, normalizeRole } from '@/lib/auth/userProfile';
import { API_ROUTES } from '@/lib/routes';
import { auth } from '@/lib/firebase/client';
import { normalizeWorkspaceSummary, type WorkspaceSummary } from '@/lib/workspaces/workspaceTypes';
import { normalizeCapabilityKeys, type CapabilityKey } from '@/lib/capabilities/capabilityTypes';
import { resolveCapabilities } from '@/lib/capabilities/capabilityResolver';

type AuthState = {
  user: AuthUser | null;
  role: UserRole;
  workspace: WorkspaceSummary | null;
  capabilities: readonly CapabilityKey[];
  loading: boolean;
  error: string | null;
};

const AUTH_HYDRATION_TIMEOUT_MS = 5000;
const API_ME_TIMEOUT_MS = 5000;

const getCachedRole = (uid: string): UserRole => typeof window === 'undefined' ? 'guest' : normalizeRole(window.sessionStorage.getItem('auth-role:' + uid));
const cacheRole = (uid: string, role: UserRole): void => { if (typeof window !== 'undefined') window.sessionStorage.setItem('auth-role:' + uid, role); };

async function fetchWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('Request timed out after ' + timeoutMs + 'ms')), timeoutMs);
    promise.then((value) => { window.clearTimeout(timeoutId); resolve(value); }, (error) => { window.clearTimeout(timeoutId); reject(error); });
  });
}
export function useAuthUser(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole>('guest');
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [capabilities, setCapabilities] = useState<readonly CapabilityKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const hydrationDeadline = window.setTimeout(() => { if (!active || authEventReceived) return; setLoading(false); }, AUTH_HYDRATION_TIMEOUT_MS);
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      authEventReceived = true;
      if (!active) return;
      if (!firebaseUser) {
        setUser(null); setRole('guest'); setWorkspace(null); setCapabilities([]); setError(null); setLoading(false); return;
      }
      const cachedRole = getCachedRole(firebaseUser.uid);
      const nextUser = firebaseUser as AuthUser;
      nextUser.role = cachedRole;
      nextUser.workspace = null;
      nextUser.capabilities = [];
      setUser(nextUser); setRole(cachedRole); setWorkspace(null); setCapabilities([]); setError(null); setLoading(true);
      try {
        const token = await fetchWithTimeout(firebaseUser.getIdToken(), API_ME_TIMEOUT_MS);
        const res = await fetchWithTimeout(fetch(API_ROUTES.ME, { method: 'GET', cache: 'no-store', credentials: 'include', headers: { Authorization: 'Bearer ' + token } }), API_ME_TIMEOUT_MS);
        if (!res.ok) throw new Error('API error: ' + res.status);
        const data = await res.json();
        const workspace = normalizeWorkspaceSummary(data?.workspace) ?? (data?.workspaceId && data?.workspaceSlug && data?.workspaceDisplayName && data?.workspaceType && data?.workspaceStatus ? { id: String(data.workspaceId), slug: String(data.workspaceSlug), displayName: String(data.workspaceDisplayName), type: data.workspaceType, status: data.workspaceStatus } : null);
        const nextRole = normalizeRole(data?.role);
        if (nextRole === 'guest') throw new Error('Authenticated user has no application role');
        if (!workspace) throw new Error('Authenticated user has no workspace profile');
        const nextCapabilities = normalizeCapabilityKeys(data?.capabilities).length ? normalizeCapabilityKeys(data.capabilities) : resolveCapabilities({ role: nextRole, workspace, capabilities: [], uid: firebaseUser.uid });
        nextUser.role = nextRole;
        nextUser.workspace = workspace;
        nextUser.workspaceId = workspace.id;
        nextUser.workspaceSlug = workspace.slug;
        nextUser.capabilities = nextCapabilities;
        if (!active) return;
        cacheRole(firebaseUser.uid, nextRole);
        setUser(nextUser);
        setRole(nextRole);
        setWorkspace(workspace);
        setCapabilities(nextCapabilities);
        setError(null);
      } catch (error) {
        console.error('[useAuthUser] Auth flow error', error);
        if (!active) return;
        nextUser.role = cachedRole;
        nextUser.workspace = null;
        nextUser.workspaceId = undefined;
        nextUser.workspaceSlug = undefined;
        nextUser.capabilities = resolveCapabilities({ role: cachedRole, workspace: null, capabilities: [], uid: firebaseUser.uid });
        setUser(nextUser);
        setRole(cachedRole);
        setWorkspace(null);
        setCapabilities(nextUser.capabilities);
        setError('You are signed in with Firebase, but the server could not verify your app profile. Check Firebase Admin runtime credentials and the /users profile for this UID.');
      } finally {
        if (active) { window.clearTimeout(hydrationDeadline); setLoading(false); }
      }
    });
    return () => { active = false; window.clearTimeout(hydrationDeadline); unsubscribe(); };
  }, []);

  return { user, role, workspace, capabilities, loading, error };
}
