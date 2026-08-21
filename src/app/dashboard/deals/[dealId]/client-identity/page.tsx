import DealClientIdentityWorkflow from "@/components/client-identity/DealClientIdentityWorkflow";
import { EnterpriseEmptyState } from "@/components/ui/EnterpriseUI";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUserFromSession } from "@/lib/server/authz";

export const dynamic = "force-dynamic";

export default async function DealClientIdentityPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  try {
    const actor = await requireAuthorizedUserFromSession();
    assertPrivilegedRole(actor);
  } catch (error) {
    const detail = error instanceof AuthorizationError ? error.message : "Client identity workflow could not be loaded.";
    return (
      <main className="tex-shell">
        <EnterpriseEmptyState title="Client identity workflow unavailable" detail={detail} />
      </main>
    );
  }
  return <DealClientIdentityWorkflow dealId={dealId} />;
}
