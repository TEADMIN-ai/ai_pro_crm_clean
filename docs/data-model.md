# Torque Empire CRM – Data Model Doctrine

This document defines the canonical Firestore data model for the Torque Empire CRM.

All collections, fields, and relationships must follow this structure unless formally revised.

No undocumented fields are permitted in production.

---

## Core Design Rules

1. Every document must have an owner (`userId`) unless explicitly system-owned.
2. Every document must include `createdAt` and `updatedAt`.
3. Status fields must use controlled string unions (no free-text states).
4. No nested data structures that grow unbounded.
5. Collections must represent entities — not UI views.

---

# 1. Users Collection

Collection: `users`

Document ID: Firebase Auth UID

```ts
{
  uid: string,                 // matches Firebase Auth UID
  email: string,
  displayName: string,
  role: "admin" | "manager" | "staff" | "contractor",
  isActive: boolean,

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- UID must match Auth UID.
- Role must be controlled.
- No role inference from UI.

---

Role Hierarchy:
- admin: full access to all documents
- manager: operational oversight across deals and tenders
- staff: limited operational access
- contractor: owns and manages their own records only

# 2. Deals Collection

Collection: `deals`

Document ID: Auto-generated

```ts
{
  title: string,
  description: string,

  userId: string,              // owner (contractor)
  assignedTo?: string,         // staff UID (optional)

  status: 
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "rejected"
    | "archived",

  value: number,               // estimated deal value
  currency: string,            // e.g. "ZAR"

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- `userId` is required.
- Status must match defined union.
- Admin visibility does not remove user ownership.

---

# 3. Tenders Collection

Collection: `tenders`

```ts
{
  title: string,
  referenceNumber: string,
  issuingAuthority: string,

  userId: string,              // contractor owner

  submissionDeadline: Timestamp,
  status:
    | "open"
    | "in_progress"
    | "submitted"
    | "awarded"
    | "lost",

  score?: number,              // evaluation score
  evaluationNotes?: string,

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- Must be scoped by `userId`.
- Status must be controlled.
- Scores must not be stored as strings.

---

# 4. Audit Logs Collection

Collection: `auditLogs`

```ts
{
  entityType: "deal" | "tender" | "user",
  entityId: string,

  action: string,              // e.g. "created", "updated", "status_changed"
  performedBy: string,         // UID

  previousState?: object,
  newState?: object,

  createdAt: Timestamp
}
```

Rules:
- Audit logs are append-only.
- No updates allowed.
- Used for traceability.

---

# 5. System Metadata (Optional Future)

Collection: `systemConfig`

```ts
{
  key: string,
  value: any,
  updatedAt: Timestamp
}
```

Rules:
- No user ownership.
- Admin-only writes.
- Limited usage.

---

# Ownership Model

All user-generated documents must contain:

```
userId: string
```

All queries must scope by:

```ts
where("userId", "==", userId)
```

Admin-level functions may bypass this — but must be explicitly named.

No mixed-scope queries.

---

# Indexing Strategy (Firestore)

Composite indexes required for:

- deals (userId + status)
- tenders (userId + status)
- tenders (submissionDeadline + status)

Avoid unindexed queries in production.

---

# Data Evolution Rule

Any change to:
- Field names
- Status unions
- Ownership model
- Collection names

Requires:
1. Update to this document
2. Migration plan
3. PR approval

No silent schema drift allowed.

---

---

# BOQ & Pricing Engine Doctrine

This section defines how the system calculates tender pricing using AI, then enforces Manager approval and Contractor sign-off.

Pricing must be versioned and auditable. No silent overwrites.

---

## 1. Rate Libraries

### 1.1 Construction Rates
Collection: `rateLibraries_construction`

Document ID: auto-generated (or a meaningful key like `default-2026`)

```ts
{
  name: string,                       // e.g. "Default Construction Rates 2026"
  region: string,                     // e.g. "Gauteng"
  currency: string,                   // "ZAR"
  isActive: boolean,

  // Rates stored as structured entries
  items: [
    {
      code: string,                   // internal rate code e.g. "CONC-25MPA"
      description: string,
      unit: string,                   // e.g. "m3", "m2", "lm", "each"
      materialRate: number,           // base material rate per unit
      labourRate: number,             // base labour rate per unit
      plantRate: number,              // optional equipment/plant rate per unit
      lastUpdatedAt: Timestamp
    }
  ],

  createdBy: string,                  // admin/manager UID
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- Only admin/manager may create or update rate libraries.
- Only one active default per region should exist at a time.

---

### 1.2 Goods & Services Rates
Collection: `rateLibraries_goods_services`

```ts
{
  name: string,                       // e.g. "Supplier Catalog - Q1 2026"
  supplierName?: string,              // optional if tied to supplier
  currency: string,                   // "ZAR"
  isActive: boolean,

  items: [
    {
      sku: string,                    // internal or supplier SKU
      description: string,
      unit: string,                   // e.g. "each", "box", "month"
      costPrice: number,              // base cost
      recommendedSellPrice?: number,  // optional
      lastUpdatedAt: Timestamp
    }
  ],

  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- Only admin/manager may update catalogs.
- Catalogs can be supplier-specific or internal.

---

## 2. Pricing Jobs (AI Calculation Runs)

Collection: `pricingJobs`

One pricing job represents one AI calculation attempt for a tender/deal.

```ts
{
  entityType: "deal" | "tender",
  entityId: string,

  userId: string,                     // contractor owner
  createdBy: string,                  // staff/manager UID who triggered the job

  pricingType: "construction_boq" | "goods_services_schedule",

  inputFiles: [
    {
      fileName: string,
      storagePath: string,            // Firebase Storage path
      uploadedAt: Timestamp
    }
  ],

  extraction: {
    source: "ai",
    notes?: string
  },

  status:
    | "queued"
    | "extracting"
    | "calculating"
    | "awaiting_manager_approval"
    | "awaiting_contractor_signoff"
    | "approved"
    | "rejected",

  // Margin rules applied during calculation
  margin: {
    overheadPercent: number,          // e.g. 10
    profitPercent: number,            // e.g. 15
    contingencyPercent?: number       // optional
  },

  // Selected rate library used for mapping items
  rateLibraryRef: {
    libraryType: "construction" | "goods_services",
    libraryId: string
  },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- A pricing job is versioned by creating a new document per run.
- Do not overwrite past pricing jobs.

---

## 3. Line Items (Normalized Pricing Output)

Collection: `pricingLineItems`

Stores the normalized result for each extracted BOQ line or schedule line, linked to a pricing job.

```ts
{
  pricingJobId: string,
  entityType: "deal" | "tender",
  entityId: string,

  lineNumber: number,
  rawDescription: string,
  normalizedDescription: string,

  unit: string,
  quantity: number,

  mappedRateCode?: string,            // for construction
  mappedSku?: string,                 // for goods/services

  rates: {
    materialRate?: number,
    labourRate?: number,
    plantRate?: number,
    costPrice?: number
  },

  calculated: {
    unitRate: number,                 // final unit rate used
    lineTotal: number                 // quantity * unitRate
  },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- Line items are immutable after contractor sign-off.
- If changes are required, create a new pricing job.

---

## 4. Pricing Summary (Totals + Snapshot)

Collection: `pricingSummaries`

```ts
{
  pricingJobId: string,
  entityType: "deal" | "tender",
  entityId: string,

  totals: {
    subTotal: number,
    overheadAmount: number,
    profitAmount: number,
    contingencyAmount?: number,
    grandTotal: number
  },

  currency: string,

  approvals: {
    managerApprovedBy?: string,
    managerApprovedAt?: Timestamp,
    managerNotes?: string,

    contractorSignedOffBy?: string,
    contractorSignedOffAt?: Timestamp,
    contractorNotes?: string
  },

  exported: {
    lastExportedAt?: Timestamp,
    exportedBy?: string,
    exportFormat?: "pdf" | "excel",
    emailedToContractorAt?: Timestamp
  },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Rules:
- Export/email actions must be logged here and/or in `auditLogs`.
- Once contractor signs off, totals are locked.

---

## 5. Enforcement Model

Pricing approvals follow the ladder:

AI calculates  
→ Manager approves  
→ Contractor signs off

No submission is allowed unless:

- pricingJobs.status == "approved"
- pricingSummaries.approvals.contractorSignedOffAt exists

All invalid approval actions must be rejected in business logic.

---

End of BOQ & Pricing Engine Doctrine.

