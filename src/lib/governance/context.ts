import type { NextRequest } from "next/server";
import type { RouteClassification } from "@/lib/governance/classification";

export type GovernanceActorMetadata = {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
};

export type GovernanceRouteMetadata = {
  method?: string | null;
  routePath?: string | null;
  sourceName: string;
  sourceType?: "route" | "service";
  sourceClassification?: RouteClassification | null;
};

export type GovernanceContext = {
  correlationId: string;
  requestId: string;
  timestamp: string;
  actor: GovernanceActorMetadata;
  route: GovernanceRouteMetadata;
};

function createUuid(): string {
  return crypto.randomUUID();
}

function getHeaderValue(request: NextRequest | undefined, key: string): string | null {
  const value = request?.headers.get(key);
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function createCorrelationId(request?: NextRequest): string {
  return (
    getHeaderValue(request, "x-correlation-id") ??
    getHeaderValue(request, "x-frontend-trace-id") ??
    createUuid()
  );
}

export function createRequestId(request?: NextRequest): string {
  return getHeaderValue(request, "x-request-id") ?? createUuid();
}

export function createGovernanceContext(input: {
  request?: NextRequest;
  actor?: GovernanceActorMetadata;
  route: GovernanceRouteMetadata;
}): GovernanceContext {
  return {
    correlationId: createCorrelationId(input.request),
    requestId: createRequestId(input.request),
    timestamp: new Date().toISOString(),
    actor: {
      actorId: input.actor?.actorId ?? null,
      actorEmail: input.actor?.actorEmail ?? null,
      actorRole: input.actor?.actorRole ?? null,
    },
    route: {
      sourceType: input.route.sourceType ?? "route",
      sourceName: input.route.sourceName,
      routePath: input.route.routePath ?? null,
      method: input.route.method ?? input.request?.method ?? null,
      sourceClassification: input.route.sourceClassification ?? null,
    },
  };
}
