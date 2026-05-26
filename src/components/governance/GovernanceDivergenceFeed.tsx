import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { GovernanceEvent } from "@/lib/governance/types";

function toneForEvent(eventType: string): "danger" | "warning" | "info" | "neutral" {
  if (eventType === "canonical_overwrite_after_legacy_write_observed") return "danger";
  if (eventType === "legacy_canonical_divergence_observed") return "warning";
  if (eventType === "stale_state_compensation_observed") return "warning";
  return "info";
}

export default function GovernanceDivergenceFeed({
  events,
}: {
  events: GovernanceEvent[];
}) {
  return (
    <Card>
      <div className="governance-section-header">
        <div>
          <p className="dashboard-eyebrow">Divergence Activity Feed</p>
          <h2 className="governance-section-title">Recent passive observations</h2>
        </div>
        <Badge tone="info">Operational visibility</Badge>
      </div>

      <div className="governance-feed-list">
        {events.length === 0 ? (
          <div className="governance-feed-empty">
            No recent divergence observations have been captured in this process yet.
          </div>
        ) : (
          events.map((event) => (
            <article key={event.eventId} className="governance-feed-item">
              <div className="governance-feed-meta">
                <span>{new Date(event.occurredAt).toLocaleString()}</span>
                <span>{event.source.sourceName}</span>
              </div>
              <div className="governance-feed-body">
                <div>
                  <h3 className="governance-feed-title">{event.eventType}</h3>
                  <p className="governance-feed-context">
                    {event.entity?.contractorId ? `Contractor ${event.entity.contractorId}` : "No contractor context"}
                    {" · "}
                    {event.entity?.dealId
                      ? `Deal ${event.entity.dealId}`
                      : event.entity?.entityId
                        ? `Entity ${event.entity.entityId}`
                        : "No entity context"}
                  </p>
                </div>
                <div className="governance-feed-badges">
                  <Badge tone={toneForEvent(event.eventType)}>{event.eventType}</Badge>
                  <Badge tone="neutral">{event.governance.routeClassification ?? "unknown"}</Badge>
                  {event.comparison?.divergenceClassification ? (
                    <Badge tone="warning">{event.comparison.divergenceClassification}</Badge>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </Card>
  );
}
