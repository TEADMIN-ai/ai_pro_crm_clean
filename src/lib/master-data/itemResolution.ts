import type { MasterDataRepository } from "@/lib/master-data/service";
import type { CanonicalItem, ItemResolutionResult } from "@/types/masterData";

export type QuoteLineItemResolutionInput = {
  workspaceId: string;
  itemId?: string | null;
  reviewerApprovedItemId?: string | null;
  description?: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function resolveQuoteLineItem(input: {
  repository: MasterDataRepository;
  line: QuoteLineItemResolutionInput;
}): Promise<ItemResolutionResult> {
  const requestedId = text(input.line.itemId) ?? text(input.line.reviewerApprovedItemId);
  if (!requestedId) {
    return {
      status: text(input.line.description) ? "REVIEW_REQUIRED" : "UNRESOLVED",
      itemId: null,
      sourceReference: text(input.line.description),
      reason: text(input.line.description) ? "Description-only item match requires review." : "No item reference supplied.",
    };
  }

  const item = await input.repository.getByCanonicalId("item", requestedId);
  if (!item || item.entityType !== "item") {
    return {
      status: "UNRESOLVED",
      itemId: null,
      sourceReference: requestedId,
      reason: "Item_ID does not resolve to a canonical Item.",
    };
  }

  const canonicalItem = item as CanonicalItem;
  if (canonicalItem.workspaceId !== input.line.workspaceId) {
    return {
      status: "BLOCKED",
      itemId: null,
      sourceReference: requestedId,
      reason: "Item belongs to a different workspace.",
    };
  }

  return {
    status: "RESOLVED",
    itemId: canonicalItem.itemId,
    sourceReference: requestedId,
    reason: "Exact or reviewer-approved Item_ID resolved.",
  };
}
