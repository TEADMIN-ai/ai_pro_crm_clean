import type { GovernanceEvent } from "@/lib/governance/types";

const MAX_GOVERNANCE_EVENTS = 180;
const governanceEventBuffer: GovernanceEvent[] = [];

export function recordGovernanceEvent(event: GovernanceEvent): void {
  governanceEventBuffer.unshift(event);

  if (governanceEventBuffer.length > MAX_GOVERNANCE_EVENTS) {
    governanceEventBuffer.length = MAX_GOVERNANCE_EVENTS;
  }
}

export function getRecentGovernanceEvents(limit = 40): GovernanceEvent[] {
  return governanceEventBuffer.slice(0, Math.max(0, limit));
}
