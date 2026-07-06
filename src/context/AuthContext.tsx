"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import type { UserRole } from '@/lib/auth/roleUtils';
import { authFetch } from '@/lib/client/authFetch';
import { type AuthUser, normalizeContractorId } from '@/lib/auth/userProfile';
import { API_ROUTES } from '@/lib/routes';
import { useAuthUser } from '@/hooks/useAuthUser';
import type { WorkspaceSummary } from '@/lib/workspaces/workspaceTypes';
import type { CapabilityKey } from '@/lib/capabilities/capabilityTypes';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  workspace: WorkspaceSummary | null;
  workspaceId?: string;
  contractorId?: string;
  capabilities: readonly CapabilityKey[];
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: 'guest', workspace: null, workspaceId: undefined, contractorId: undefined, capabilities: [], loading: true, error: null, logout: async () => {} });
async function clearServerSession(): Promise<void> { if (!auth.currentUser) return; await authFetch(API_ROUTES.AUTH_LOGOUT, { method: 'POST', credentials: 'include' }); }
function clearClientAuthCache(uid?: string): void { if (typeof window === 'undefined') return; try { window.sessionStorage.removeItem('authToken'); window.localStorage.removeItem('authToken'); window.sessionStorage.removeItem('show_ai_boot'); if (uid) window.sessionStorage.removeItem('auth-role:' + uid); const keysToRemove: string[] = []; for (let index = 0; index < window.sessionStorage.length; index += 1) { const key = window.sessionStorage.key(index); if (key?.startsWith('auth-role:')) keysToRemove.push(key); } keysToRemove.forEach((key) => window.sessionStorage.removeItem(key)); } catch (error) { console.warn('[AuthContext] Failed to clear client auth cache', error); } }
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authState = useAuthUser();
  const [contractorId, setContractorId] = useState<string | undefined>(undefined);

  useEffect(() => { let cancelled = false; if (authState.loading) { return () => { cancelled = true; }; } if (!authState.user) { setContractorId(undefined); return () => { cancelled = true; }; } if (authState.role !== 'contractor') { setContractorId(undefined); return () => { cancelled = true; }; } async function syncContractorContext() { try { const response = await authFetch(API_ROUTES.SYNC_ROLE, { method: 'POST', credentials: 'include' }); const data = (await response.json()) as { contractorId?: string | null }; if (cancelled) return; const normalizedContractorId = normalizeContractorId(data.contractorId ?? null); setContractorId(normalizedContractorId); } catch (error) { console.error('[AuthContext] Contractor sync failed', error); if (cancelled) return; setContractorId(authState.user.contractorId); } } void syncContractorContext(); return () => { cancelled = true; }; }, [authState.loading, authState.role, authState.user?.uid]);
  const logout = async () => { try { await clearServerSession(); await signOut(auth); } finally { clearClientAuthCache(authState.user?.uid); setContractorId(undefined); if (typeof window !== 'undefined') { window.location.replace('/login'); return; } router.replace('/login'); } };
  return (<AuthContext.Provider value={{ user: authState.user, role: authState.role, workspace: authState.workspace, workspaceId: authState.workspace?.id, contractorId, capabilities: authState.capabilities, loading: authState.loading, error: authState.error, logout }}>{children}</AuthContext.Provider>);
}
export const useAuth = () => useContext(AuthContext);
