import MasterDataReviewWorkspace from "@/components/master-data/MasterDataReviewWorkspace";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUserFromSession } from "@/lib/server/authz";

export const dynamic = "force-dynamic";

export default async function MasterDataReviewPage() {
  const access = await resolveAccess();
  if ("workspaceId" in access) return <MasterDataReviewWorkspace workspaceId={access.workspaceId} />;
  return <ReviewMessage tone={access.status === 403 || access.status === 401 ? "danger" : "warning"} message={access.message} />;
}

async function resolveAccess(): Promise<{ ok: true; workspaceId: string } | { ok: false; status: number; message: string }> {
  try {
    const actor = await requireAuthorizedUserFromSession();
    assertPrivilegedRole(actor);
    if (!actor.workspaceId) return { ok: false, status: 400, message: "Workspace context is required for Master Data review." };
    return { ok: true, workspaceId: actor.workspaceId };
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return {
      ok: false,
      status,
      message: status === 401 || status === 403 ? "Master Data review requires privileged staff access." : "Master Data review could not be loaded.",
    };
  }
}

function ReviewMessage({ tone, message }: { tone: "warning" | "danger"; message: string }) {
  const className = tone === "danger"
    ? "rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700"
    : "rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800";
  return <main className="tex-shell"><p className={className}>{message}</p></main>;
}
