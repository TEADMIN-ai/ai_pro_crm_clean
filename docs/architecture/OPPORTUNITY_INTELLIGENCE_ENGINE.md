# Opportunity Intelligence Engine

**Status:** Architecture contracts only
**Revision:** 2026-07-12
**Scope:** Opportunity intelligence service interfaces

## Purpose
The Opportunity Intelligence Engine defines reusable contracts for evaluating opportunity records. This layer is intentionally interface-only. It does not perform OCR, AI analysis, scoring formulas, persistence, or workflow mutation.

## Source Of Truth
- Domain contracts: `src/types/opportunityIntelligence.ts`
- Service ports: `src/lib/opportunities/intelligence/services.ts`
- Public exports: `src/lib/opportunities/intelligence/index.ts`

## Service Interfaces
The engine defines ports for:

- Opportunity Matching
- Contractor Matching
- Readiness Scoring
- Win Probability
- Opportunity Priority
- Risk Scoring
- Expected Revenue
- Closing Date Intelligence
- Municipality Classification
- Tender Type Classification

## Architecture Rules
- Inputs are typed snapshots of existing source-of-truth records.
- Outputs must carry evidence, confidence, missing inputs, and schema version.
- Implementations must be added behind these interfaces.
- AI providers, OCR, document parsing, and external integrations belong in separate adapters.
- No service interface may mutate contractor workflows, tender workflows, or opportunity records directly.

## Integration Boundary
Future implementations should compose the service ports through `OpportunityIntelligenceEngine`. The aggregate engine should produce an `OpportunityIntelligenceSnapshot` that can be persisted or projected by a separate application service.

