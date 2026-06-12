export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import {
  recordDecisionLog,
  recordIntelligenceAuditLog,
  recordSystemMetric,
} from "@/server/services/intelligenceCenterService";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);

    const body = asRecord(await request.json());
    const eventKind = asString(body.eventKind);
    const metadata = asRecord(body.metadata);

    if (eventKind === "decision") {
      const result = await recordDecisionLog({
        contractorId: asString(body.contractorId),
        previousReadinessScore: asNumber(body.previousReadinessScore),
        newReadinessScore: asNumber(body.newReadinessScore),
        triggerEvent: asString(body.triggerEvent),
        reasonForChange: asString(body.reasonForChange),
        metadata,
      });
      return NextResponse.json({ event: result }, { status: 201 });
    }

    if (eventKind === "metric") {
      const result = await recordSystemMetric({
        metricType: asString(body.metricType) ?? "system_metric",
        route: asString(body.route),
        durationMs: asNumber(body.durationMs),
        contractorId: asString(body.contractorId),
        targetId: asString(body.targetId),
        metadata,
      });
      return NextResponse.json({ event: result }, { status: 201 });
    }

    const eventType = asString(body.eventType);
    if (!eventType) {
      return NextResponse.json({ error: "eventType is required for audit events" }, { status: 400 });
    }

    const result = await recordIntelligenceAuditLog({
      eventType,
      actorId: asString(body.actorId) ?? actor.uid,
      actorRole: asString(body.actorRole) ?? actor.role,
      contractorId: asString(body.contractorId),
      targetId: asString(body.targetId),
      previousValue: body.previousValue ?? null,
      newValue: body.newValue ?? null,
      metadata,
    });

    return NextResponse.json({ event: result }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[intelligence-center] event ingestion failed", error);
    return NextResponse.json({ error: "Intelligence event ingestion unavailable" }, { status: 500 });
  }
}
