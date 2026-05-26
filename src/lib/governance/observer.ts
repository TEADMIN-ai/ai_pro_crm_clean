import type { NextRequest } from "next/server";
import { createGovernanceContext, type GovernanceContext, type GovernanceRouteMetadata } from "@/lib/governance/context";
import { emitGovernanceEvent } from "@/lib/governance/emitter";

type RouteHandler<TContext> = (
  request: NextRequest,
  context: TContext,
  governanceContext: GovernanceContext
) => Response | Promise<Response>;

export function withGovernanceObservation<TContext>(
  route: GovernanceRouteMetadata,
  handler: RouteHandler<TContext>
) {
  return async function observedHandler(
    request: NextRequest,
    context: TContext
  ): Promise<Response> {
    const governanceContext = createGovernanceContext({
      request,
      route,
    });
    const startedAt = Date.now();

    emitGovernanceEvent({
      eventId: crypto.randomUUID(),
      eventVersion: "v1",
      occurredAt: governanceContext.timestamp,
      category: "route_invocation",
      eventType: "route_invoked",
      correlation: {
        correlationId: governanceContext.correlationId,
        requestId: governanceContext.requestId,
      },
      source: {
        sourceType: governanceContext.route.sourceType ?? "route",
        sourceName: governanceContext.route.sourceName,
        routePath: governanceContext.route.routePath ?? null,
        method: governanceContext.route.method ?? request.method,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
      },
      governance: {
        routeClassification: governanceContext.route.sourceClassification ?? null,
        sourceClassification: governanceContext.route.sourceClassification ?? null,
        failOpen: true,
      },
    });

    try {
      const response = await handler(request, context, governanceContext);

      emitGovernanceEvent({
        eventId: crypto.randomUUID(),
        eventVersion: "v1",
        occurredAt: new Date().toISOString(),
        category: "route_completion",
        eventType: "route_completed",
        correlation: {
          correlationId: governanceContext.correlationId,
          requestId: governanceContext.requestId,
        },
        source: {
          sourceType: governanceContext.route.sourceType ?? "route",
          sourceName: governanceContext.route.sourceName,
          routePath: governanceContext.route.routePath ?? null,
          method: governanceContext.route.method ?? request.method,
          sourceClassification: governanceContext.route.sourceClassification ?? null,
        },
        governance: {
          routeClassification: governanceContext.route.sourceClassification ?? null,
          sourceClassification: governanceContext.route.sourceClassification ?? null,
          latencyMs: Date.now() - startedAt,
          failOpen: true,
        },
      });

      return response;
    } catch (error) {
      emitGovernanceEvent({
        eventId: crypto.randomUUID(),
        eventVersion: "v1",
        occurredAt: new Date().toISOString(),
        category: "route_completion",
        eventType: "route_failed",
        correlation: {
          correlationId: governanceContext.correlationId,
          requestId: governanceContext.requestId,
        },
        source: {
          sourceType: governanceContext.route.sourceType ?? "route",
          sourceName: governanceContext.route.sourceName,
          routePath: governanceContext.route.routePath ?? null,
          method: governanceContext.route.method ?? request.method,
          sourceClassification: governanceContext.route.sourceClassification ?? null,
        },
        governance: {
          routeClassification: governanceContext.route.sourceClassification ?? null,
          sourceClassification: governanceContext.route.sourceClassification ?? null,
          latencyMs: Date.now() - startedAt,
          failOpen: true,
        },
      });

      throw error;
    }
  };
}
