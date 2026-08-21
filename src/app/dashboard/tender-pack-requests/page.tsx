import RequireRole from "@/components/auth/RequireRole";
import TenderPackBuilderWorkspace from "@/components/tender/TenderPackBuilderWorkspace";

export default async function TenderPackRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ dealId?: string; requestId?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <TenderPackBuilderWorkspace dealId={params.dealId} requestId={params.requestId} />
    </RequireRole>
  );
}
