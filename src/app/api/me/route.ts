import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { buildUserProfile } from '@/lib/auth/userProfile';
import { getFirebaseAdmin } from '@/lib/firebase/admin';
import { resolveAuthorizedIdentity } from '@/lib/server/authz';
import { getWorkspaceBySlug, toWorkspaceRegistrySummary } from '@/lib/workspaces/workspaceRegistry';
import { resolveWorkspace, WorkspaceResolutionError } from '@/lib/workspaces/workspaceResolver';
export const runtime = 'nodejs';

const LEGACY_WORKSPACE_SLUG = 'torque-empire';

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

function hasExplicitWorkspaceAssignment(profileData: Record<string, unknown>): boolean {
  return Boolean(profileData.workspace || profileData.workspaceId || profileData.workspaceSlug);
}

async function migrateLegacyWorkspaceAssignment(uid: string) {
  const workspaceRecord = getWorkspaceBySlug(LEGACY_WORKSPACE_SLUG);
  if (!workspaceRecord) {
    throw new Error('Canonical workspace not found');
  }

  const workspace = toWorkspaceRegistrySummary(workspaceRecord);
  await getFirebaseAdmin().collection('users').doc(uid).set(
    {
      workspace,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return workspace;
}

export async function GET(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    const tokenClaims = decodedToken as Record<string, unknown>;
    let profileData: Record<string, unknown> = {};
    try {
      const profileSnapshot = await getFirebaseAdmin().collection('users').doc(decodedToken.uid).get();
      profileData = profileSnapshot.exists ? ((profileSnapshot.data() ?? {}) as Record<string, unknown>) : {};
    } catch (profileError) {
      console.error('[/api/me] FIRESTORE READ FAILURE', profileError);
      return NextResponse.json({ error: 'PROFILE_LOOKUP_FAILED' }, { status: 500 });
    }
    const profile = buildUserProfile(profileData);
    if (profile.role === 'admin' && !hasExplicitWorkspaceAssignment(profileData) && !profile.workspace && !profile.workspaceId && !profile.workspaceSlug) {
      try {
        const migratedWorkspace = await migrateLegacyWorkspaceAssignment(decodedToken.uid);
        profile.workspace = migratedWorkspace;
        profile.workspaceId = migratedWorkspace.id;
        profile.workspaceSlug = migratedWorkspace.slug;
      } catch (migrationError) {
        console.error('[/api/me] WORKSPACE MIGRATION FAILED', migrationError);
        return NextResponse.json({ error: 'WORKSPACE_MIGRATION_FAILED' }, { status: 500 });
      }
    }

    const resolved = await resolveAuthorizedIdentity({ uid: decodedToken.uid, email: decodedToken.email ?? undefined, role: decodedToken.role, contractorId: decodedToken.contractorId, profile });
    const workspace = resolveWorkspace({ workspace: resolved.profile?.workspace ?? profile.workspace, workspaceId: resolved.profile?.workspaceId ?? profile.workspaceId ?? tokenClaims.workspaceId, slug: resolved.profile?.workspaceSlug ?? profile.workspaceSlug ?? tokenClaims.workspaceSlug });
    return NextResponse.json({
      uid: resolved.uid,
      email: resolved.email ?? null,
      role: resolved.role,
      contractorId: resolved.contractorId ?? null,
      capabilities: resolved.capabilities,
      workspace,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      company: resolved.profile?.company ?? null,
      status: resolved.profile?.status ?? null,
    }, { status: 200 });
  } catch (error) {
    if (error instanceof WorkspaceResolutionError) {
      console.error('[/api/me] Workspace resolution failed', error);
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[/api/me] Auth flow failed', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
