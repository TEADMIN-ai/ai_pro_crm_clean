import { EnterpriseEmptyState } from "@/components/ui/EnterpriseUI";

export function EmptyState({ label }: { label: string }) {
  return <EnterpriseEmptyState title={label} />;
}
