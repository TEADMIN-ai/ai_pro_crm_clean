import CorporateBrandMark from "@/components/branding/CorporateBrandMark";
import { TORQUE_EMPIRE_BRAND } from "@/lib/branding/identity";

export default function DashboardLoading() {
  return (
    <div className="rounded-[28px] border border-[color:var(--tex-border)] bg-white p-6 shadow-[0_18px_48px_rgba(7,17,31,0.08)]">
      <div className="flex items-center gap-4">
        <CorporateBrandMark tone="light" compact showTagline={false} />
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--tex-text-strong)]">
            Loading {TORQUE_EMPIRE_BRAND.shortName} Workspace
          </h2>
          <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">
            Preparing brand assets, workspace data, and secure navigation.
          </p>
        </div>
      </div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/2 rounded-full bg-[color:var(--tex-primary)] transition-all duration-700" />
      </div>
    </div>
  );
}
