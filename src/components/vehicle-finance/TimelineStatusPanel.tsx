import Badge from "@/components/ui/Badge";

type Props = {
  loading: boolean;
  syncPending: boolean;
  hasActivity: boolean;
  onRetry: () => void;
};

export default function TimelineStatusPanel({ loading, syncPending, hasActivity, onRetry }: Props) {
  if (!loading && !syncPending && hasActivity) return null;

  const title = loading || syncPending ? "Timeline syncing" : "No timeline activity yet";
  const description = loading || syncPending
    ? "Application activity is being prepared. Existing applications remain available."
    : "Activity will appear here as the application moves through verification and decisioning.";

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <Badge tone="warning">{loading ? "Syncing" : syncPending ? "Pending" : "Ready"}</Badge>
        <div>
          <p className="text-sm font-semibold text-amber-50">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
        </div>
      </div>
      {!loading && syncPending ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex shrink-0 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-200/15 sm:mt-0"
        >
          Retry timeline
        </button>
      ) : null}
    </div>
  );
}
