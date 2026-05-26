export const ROUTE_CLASSIFICATIONS = {
  CANONICAL: "canonical",
  LEGACY: "legacy",
  HYBRID: "hybrid",
  OBSERVER_ONLY: "observer_only",
} as const;

export type RouteClassification =
  (typeof ROUTE_CLASSIFICATIONS)[keyof typeof ROUTE_CLASSIFICATIONS];

export const MUTATION_CLASSIFICATIONS = {
  LEGACY_DIRECT_VERIFIED_WRITE: "legacy_direct_verified_write",
  LEGACY_TOP_LEVEL_DOCUMENT_STATUS_WRITE: "legacy_top_level_document_status_write",
  LEGACY_DEAL_READINESS_WRITE: "legacy_deal_readiness_write",
  LEGACY_GET_SIDE_EFFECT_WRITE: "legacy_get_side_effect_write",
} as const;

export type MutationClassification =
  (typeof MUTATION_CLASSIFICATIONS)[keyof typeof MUTATION_CLASSIFICATIONS];

export const AUTHORITY_CLASSIFICATIONS = {
  SOURCE_OF_TRUTH: "source_of_truth",
  DERIVED_WRITER: "derived_writer",
  BYPASS_WRITER: "bypass_writer",
  OBSERVER_ONLY: "observer_only",
} as const;

export type AuthorityClassification =
  (typeof AUTHORITY_CLASSIFICATIONS)[keyof typeof AUTHORITY_CLASSIFICATIONS];

export const DIVERGENCE_CLASSIFICATIONS = {
  LEGACY_CANONICAL_STATUS_MATCH: "legacy_canonical_status_match",
  LEGACY_CANONICAL_STATUS_MISMATCH: "legacy_canonical_status_mismatch",
  STALE_STATE_COMPENSATION: "stale_state_compensation",
  CANONICAL_OVERWRITE_AFTER_LEGACY_WRITE: "canonical_overwrite_after_legacy_write",
} as const;

export type DivergenceClassification =
  (typeof DIVERGENCE_CLASSIFICATIONS)[keyof typeof DIVERGENCE_CLASSIFICATIONS];
