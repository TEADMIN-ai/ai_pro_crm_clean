// src/types/tender.types.ts
// Canonical Tender Data Contract
// JSON-compatible and versioned for cross-year schema stability.

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type TenderSchemaVersion = "2026-01";
export type TenderLifecycleStatus =
  | "draft"
  | "active"
  | "under_review"
  | "submitted"
  | "awarded"
  | "cancelled"
  | "closed";
export type TenderRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TenderComplianceStatus = "PASS" | "WARNING" | "FAIL";
export type TenderLockStatus = "READY" | "RISK" | "BLOCKED";

export interface TenderPartyRef {
  id: string;
  name: string;
  role: "buyer" | "contractor" | "internal_owner" | "partner";
  externalReference?: string | null;
}

export interface TenderValueMoney {
  amount: number;
  currency: string;
}

export interface TenderTimeline {
  publishedAt?: string | null;
  briefingAt?: string | null;
  clarificationDeadlineAt?: string | null;
  submissionDeadlineAt?: string | null;
  submittedAt?: string | null;
  awardedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TenderRequirement {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  mandatory: boolean;
  category?: string | null;
  sourceYear?: number | null;
}

export interface TenderDocumentRef {
  id: string;
  name: string;
  type?: string | null;
  storagePath?: string | null;
  url?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
  status?: "missing" | "uploaded" | "verified" | "rejected" | null;
  metadata?: JsonObject;
}

export interface TenderAnalysisSnapshot {
  issuingAuthority?: string | null;
  tenderNumber?: string | null;
  scope?: string | null;
  location?: string | null;
  estimatedValue?: TenderValueMoney | null;
  aiAnalyzedAt?: string | null;
  extractedRequirements?: string[];
  metadata?: JsonObject;
}

export interface TenderReadinessSnapshot {
  readinessScore: number;
  tenderLockStatus: TenderLockStatus;
  docsMissing: number;
  missingRequirements: string[];
  complianceStatus?: TenderComplianceStatus | null;
  riskLevel?: TenderRiskLevel | null;
  recommendations?: string[];
  evaluatedAt?: string | null;
}

export interface TenderPricingSnapshot {
  status?: string | null;
  assignedTo?: string | null;
  approvedAt?: string | null;
  value?: TenderValueMoney | null;
  estimatedValue?: TenderValueMoney | null;
  metadata?: JsonObject;
}

export interface TenderComplianceSnapshot {
  complianceMatch?: boolean | null;
  tenderLockStatus?: TenderLockStatus | null;
  readinessScore?: number | null;
  docsMissing?: number | null;
  missingRequirements?: string[];
  riskLevel?: TenderRiskLevel | null;
  updatedAt?: string | null;
  metadata?: JsonObject;
}

export interface TenderAuditActor {
  id: string;
  name?: string | null;
  role?: string | null;
  email?: string | null;
}

export interface TenderAuditEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor?: TenderAuditActor | null;
  metadata?: JsonObject;
}

export interface TenderData {
  schemaVersion: TenderSchemaVersion;
  schemaFamily: "TenderData";
  tenderId: string;
  legacyDealId?: string | null;
  tenderNumber?: string | null;
  title: string;
  description?: string | null;
  sourceYear: number;
  status: TenderLifecycleStatus;
  stage?: string | null;
  buyer?: TenderPartyRef | null;
  contractor?: TenderPartyRef | null;
  owner?: TenderPartyRef | null;
  value?: TenderValueMoney | null;
  estimatedValue?: TenderValueMoney | null;
  timeline: TenderTimeline;
  requirements: TenderRequirement[];
  documents: TenderDocumentRef[];
  pricing?: TenderPricingSnapshot | null;
  compliance?: TenderComplianceSnapshot | null;
  readiness?: TenderReadinessSnapshot | null;
  analysis?: TenderAnalysisSnapshot | null;
  tags?: string[];
  metadata?: JsonObject;
  auditTrail?: TenderAuditEvent[];
}

export interface TenderFieldSchema {
  type:
    | "string"
    | "number"
    | "boolean"
    | "null"
    | "object"
    | "array"
    | "enum";
  required?: boolean;
  description: string;
  format?: "iso-datetime" | "currency-code" | "json";
  values?: readonly string[];
  items?: TenderFieldSchema;
  properties?: Record<string, TenderFieldSchema>;
}

export interface TenderSchemaDefinition {
  schemaFamily: TenderData["schemaFamily"];
  currentVersion: TenderSchemaVersion;
  compatibleVersions: TenderSchemaVersion[];
  description: string;
  root: TenderFieldSchema;
}

const ISO_DATETIME_FIELD: TenderFieldSchema = {
  type: "string",
  required: false,
  format: "iso-datetime",
  description: "ISO-8601 datetime string.",
};

const OPTIONAL_STRING_FIELD: TenderFieldSchema = {
  type: "string",
  required: false,
  description: "Optional string value.",
};

const JSON_OBJECT_FIELD: TenderFieldSchema = {
  type: "object",
  required: false,
  format: "json",
  description: "Arbitrary JSON object for extensible metadata.",
};

export const STANDARDIZED_TENDER_SCHEMA: TenderSchemaDefinition = {
  schemaFamily: "TenderData",
  currentVersion: "2026-01",
  compatibleVersions: ["2026-01"],
  description:
    "Canonical tender schema for Tender/Deal interoperability, cross-year compatibility, and future Prisma persistence.",
  root: {
    type: "object",
    required: true,
    description: "Canonical TenderData payload.",
    properties: {
      schemaVersion: {
        type: "enum",
        required: true,
        values: ["2026-01"],
        description: "Versioned contract identifier.",
      },
      schemaFamily: {
        type: "enum",
        required: true,
        values: ["TenderData"],
        description: "Logical schema family name.",
      },
      tenderId: {
        type: "string",
        required: true,
        description: "Primary tender identifier.",
      },
      legacyDealId: {
        ...OPTIONAL_STRING_FIELD,
        description: "Legacy deal identifier for backward compatibility.",
      },
      tenderNumber: {
        ...OPTIONAL_STRING_FIELD,
        description: "Issuer-facing tender number.",
      },
      title: {
        type: "string",
        required: true,
        description: "Human-readable tender title.",
      },
      description: {
        ...OPTIONAL_STRING_FIELD,
        description: "Tender summary or narrative scope.",
      },
      sourceYear: {
        type: "number",
        required: true,
        description: "Tender issue year used for cross-year compatibility logic.",
      },
      status: {
        type: "enum",
        required: true,
        values: ["draft", "active", "under_review", "submitted", "awarded", "cancelled", "closed"],
        description: "Lifecycle state for the tender.",
      },
      stage: {
        ...OPTIONAL_STRING_FIELD,
        description: "Workflow stage name from current runtime systems.",
      },
      buyer: {
        type: "object",
        required: false,
        description: "Buyer organization reference.",
        properties: {
          id: { type: "string", required: true, description: "Party identifier." },
          name: { type: "string", required: true, description: "Party display name." },
          role: {
            type: "enum",
            required: true,
            values: ["buyer", "contractor", "internal_owner", "partner"],
            description: "Party role in the tender.",
          },
          externalReference: {
            ...OPTIONAL_STRING_FIELD,
            description: "Optional external system identifier.",
          },
        },
      },
      contractor: {
        type: "object",
        required: false,
        description: "Assigned contractor reference.",
        properties: {
          id: { type: "string", required: true, description: "Party identifier." },
          name: { type: "string", required: true, description: "Party display name." },
          role: {
            type: "enum",
            required: true,
            values: ["buyer", "contractor", "internal_owner", "partner"],
            description: "Party role in the tender.",
          },
          externalReference: {
            ...OPTIONAL_STRING_FIELD,
            description: "Optional external system identifier.",
          },
        },
      },
      owner: {
        type: "object",
        required: false,
        description: "Internal owner reference.",
        properties: {
          id: { type: "string", required: true, description: "Party identifier." },
          name: { type: "string", required: true, description: "Party display name." },
          role: {
            type: "enum",
            required: true,
            values: ["buyer", "contractor", "internal_owner", "partner"],
            description: "Party role in the tender.",
          },
          externalReference: {
            ...OPTIONAL_STRING_FIELD,
            description: "Optional external system identifier.",
          },
        },
      },
      value: {
        type: "object",
        required: false,
        description: "Committed tender value.",
        properties: {
          amount: { type: "number", required: true, description: "Monetary amount." },
          currency: {
            type: "string",
            required: true,
            format: "currency-code",
            description: "ISO-style currency code.",
          },
        },
      },
      estimatedValue: {
        type: "object",
        required: false,
        description: "Estimated tender value.",
        properties: {
          amount: { type: "number", required: true, description: "Monetary amount." },
          currency: {
            type: "string",
            required: true,
            format: "currency-code",
            description: "ISO-style currency code.",
          },
        },
      },
      timeline: {
        type: "object",
        required: true,
        description: "Canonical tender timeline fields.",
        properties: {
          publishedAt: { ...ISO_DATETIME_FIELD, description: "Publication timestamp." },
          briefingAt: { ...ISO_DATETIME_FIELD, description: "Briefing timestamp." },
          clarificationDeadlineAt: {
            ...ISO_DATETIME_FIELD,
            description: "Clarification deadline timestamp.",
          },
          submissionDeadlineAt: {
            ...ISO_DATETIME_FIELD,
            description: "Submission deadline timestamp.",
          },
          submittedAt: { ...ISO_DATETIME_FIELD, description: "Submission timestamp." },
          awardedAt: { ...ISO_DATETIME_FIELD, description: "Award timestamp." },
          closedAt: { ...ISO_DATETIME_FIELD, description: "Close timestamp." },
          createdAt: { ...ISO_DATETIME_FIELD, description: "Record creation timestamp." },
          updatedAt: { ...ISO_DATETIME_FIELD, description: "Record update timestamp." },
        },
      },
      requirements: {
        type: "array",
        required: true,
        description: "Tender requirements captured as structured records.",
        items: {
          type: "object",
          description: "Tender requirement record.",
          properties: {
            id: { type: "string", required: true, description: "Requirement identifier." },
            code: { ...OPTIONAL_STRING_FIELD, description: "Optional requirement code." },
            title: { type: "string", required: true, description: "Requirement title." },
            description: { ...OPTIONAL_STRING_FIELD, description: "Requirement description." },
            mandatory: { type: "boolean", required: true, description: "Mandatory flag." },
            category: { ...OPTIONAL_STRING_FIELD, description: "Requirement category." },
            sourceYear: {
              type: "number",
              required: false,
              description: "Requirement origin year for year-aware transforms.",
            },
          },
        },
      },
      documents: {
        type: "array",
        required: true,
        description: "Tender document references.",
        items: {
          type: "object",
          description: "Tender document reference record.",
          properties: {
            id: { type: "string", required: true, description: "Document identifier." },
            name: { type: "string", required: true, description: "Document name." },
            type: { ...OPTIONAL_STRING_FIELD, description: "Document type code." },
            storagePath: { ...OPTIONAL_STRING_FIELD, description: "Storage path." },
            url: { ...OPTIONAL_STRING_FIELD, description: "Resolvable document URL." },
            uploadedAt: { ...ISO_DATETIME_FIELD, description: "Upload timestamp." },
            uploadedBy: { ...OPTIONAL_STRING_FIELD, description: "Uploader identifier." },
            status: {
              type: "enum",
              required: false,
              values: ["missing", "uploaded", "verified", "rejected"],
              description: "Document lifecycle status.",
            },
            metadata: {
              ...JSON_OBJECT_FIELD,
              description: "Extensible JSON metadata for future persistence layers.",
            },
          },
        },
      },
      pricing: {
        type: "object",
        required: false,
        description: "Tender pricing snapshot.",
        properties: {
          status: { ...OPTIONAL_STRING_FIELD, description: "Pricing workflow status." },
          assignedTo: { ...OPTIONAL_STRING_FIELD, description: "Pricing owner identifier." },
          approvedAt: { ...ISO_DATETIME_FIELD, description: "Pricing approval timestamp." },
          value: {
            type: "object",
            required: false,
            description: "Committed tender value at pricing stage.",
            properties: {
              amount: { type: "number", required: true, description: "Monetary amount." },
              currency: {
                type: "string",
                required: true,
                format: "currency-code",
                description: "ISO-style currency code.",
              },
            },
          },
          estimatedValue: {
            type: "object",
            required: false,
            description: "Estimated value at pricing stage.",
            properties: {
              amount: { type: "number", required: true, description: "Monetary amount." },
              currency: {
                type: "string",
                required: true,
                format: "currency-code",
                description: "ISO-style currency code.",
              },
            },
          },
          metadata: {
            ...JSON_OBJECT_FIELD,
            description: "Extensible pricing metadata.",
          },
        },
      },
      compliance: {
        type: "object",
        required: false,
        description: "Compliance snapshot preserved from legacy tender/deal data.",
        properties: {
          complianceMatch: {
            type: "boolean",
            required: false,
            description: "Whether compliance requirements are currently matched.",
          },
          tenderLockStatus: {
            type: "enum",
            required: false,
            values: ["READY", "RISK", "BLOCKED"],
            description: "Tender lock status.",
          },
          readinessScore: {
            type: "number",
            required: false,
            description: "Readiness score from compliance evaluation.",
          },
          docsMissing: {
            type: "number",
            required: false,
            description: "Missing document count from compliance evaluation.",
          },
          missingRequirements: {
            type: "array",
            required: false,
            description: "Missing compliance requirement labels.",
            items: { type: "string", description: "Missing compliance requirement." },
          },
          riskLevel: {
            type: "enum",
            required: false,
            values: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            description: "Compliance-derived risk level.",
          },
          updatedAt: { ...ISO_DATETIME_FIELD, description: "Compliance snapshot update timestamp." },
          metadata: {
            ...JSON_OBJECT_FIELD,
            description: "Extensible compliance metadata.",
          },
        },
      },
      readiness: {
        type: "object",
        required: false,
        description: "Readiness and compliance snapshot.",
        properties: {
          readinessScore: { type: "number", required: true, description: "Readiness score." },
          tenderLockStatus: {
            type: "enum",
            required: true,
            values: ["READY", "RISK", "BLOCKED"],
            description: "Tender lock status.",
          },
          docsMissing: { type: "number", required: true, description: "Missing document count." },
          missingRequirements: {
            type: "array",
            required: true,
            description: "Missing requirement identifiers or labels.",
            items: { type: "string", description: "Missing requirement." },
          },
          complianceStatus: {
            type: "enum",
            required: false,
            values: ["PASS", "WARNING", "FAIL"],
            description: "Compliance outcome.",
          },
          riskLevel: {
            type: "enum",
            required: false,
            values: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            description: "Risk level.",
          },
          recommendations: {
            type: "array",
            required: false,
            description: "Recommendation list.",
            items: { type: "string", description: "Recommendation entry." },
          },
          evaluatedAt: { ...ISO_DATETIME_FIELD, description: "Evaluation timestamp." },
        },
      },
      analysis: {
        type: "object",
        required: false,
        description: "Tender analysis snapshot.",
        properties: {
          issuingAuthority: {
            ...OPTIONAL_STRING_FIELD,
            description: "Issuing authority name.",
          },
          tenderNumber: {
            ...OPTIONAL_STRING_FIELD,
            description: "Extracted tender number.",
          },
          scope: {
            ...OPTIONAL_STRING_FIELD,
            description: "Tender scope summary.",
          },
          location: {
            ...OPTIONAL_STRING_FIELD,
            description: "Tender location.",
          },
          estimatedValue: {
            type: "object",
            required: false,
            description: "Estimated value extracted from analysis.",
            properties: {
              amount: { type: "number", required: true, description: "Monetary amount." },
              currency: {
                type: "string",
                required: true,
                format: "currency-code",
                description: "ISO-style currency code.",
              },
            },
          },
          aiAnalyzedAt: { ...ISO_DATETIME_FIELD, description: "AI analysis timestamp." },
          extractedRequirements: {
            type: "array",
            required: false,
            description: "Requirements extracted from analysis.",
            items: { type: "string", description: "Extracted requirement." },
          },
          metadata: {
            ...JSON_OBJECT_FIELD,
            description: "Extensible analysis metadata.",
          },
        },
      },
      tags: {
        type: "array",
        required: false,
        description: "Search and segmentation tags.",
        items: { type: "string", description: "Tag value." },
      },
      metadata: {
        ...JSON_OBJECT_FIELD,
        description: "Extensible schema-safe metadata block.",
      },
      auditTrail: {
        type: "array",
        required: false,
        description: "Immutable tender audit event list.",
        items: {
          type: "object",
          description: "Tender audit event record.",
          properties: {
            id: { type: "string", required: true, description: "Audit event identifier." },
            type: { type: "string", required: true, description: "Audit event type." },
            message: { type: "string", required: true, description: "Audit event message." },
            createdAt: { ...ISO_DATETIME_FIELD, required: true, description: "Audit creation timestamp." },
            actor: {
              type: "object",
              required: false,
              description: "Actor who generated the event.",
              properties: {
                id: { type: "string", required: true, description: "Actor identifier." },
                name: { ...OPTIONAL_STRING_FIELD, description: "Actor display name." },
                role: { ...OPTIONAL_STRING_FIELD, description: "Actor role." },
                email: { ...OPTIONAL_STRING_FIELD, description: "Actor email." },
              },
            },
            metadata: {
              ...JSON_OBJECT_FIELD,
              description: "Extensible audit metadata.",
            },
          },
        },
      },
    },
  },
};
