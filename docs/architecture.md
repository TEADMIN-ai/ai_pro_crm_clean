# Torque Empire CRM – Architecture Doctrine

## Core Principle

The Torque Empire CRM enforces strict separation of concerns.  
Authentication is resolved exclusively at the UI boundary.  
Business logic functions are pure and deterministic.  
Firestore queries must always be intentionally scoped.  
No implicit fallbacks, hidden auth resolution, or silent failures are permitted.  

Clarity is preferred over convenience.

---

## System Layers

### 1. UI Layer (React / Next.js)

**Responsibilities:**
- Render views
- Resolve Firebase authentication state
- Determine user role
- Pass explicit identifiers to business logic functions

The UI layer is the only layer allowed to access:

```ts
auth.currentUser
```

Authentication must be resolved here and nowhere else.

**Example:**

```ts
const userId = auth.currentUser?.uid
if (!userId) return <Unauthorized />

const deals = await getDealsForUser(userId)
```

---

### 2. Business Logic Layer (`/src/lib/...`)

**Responsibilities:**
- Encapsulate application logic
- Query Firestore
- Validate inputs
- Transform and return structured data

**Rules:**
- Must never read from `auth.currentUser`
- Must never derive identity internally
- Must require explicit identifiers
- Must throw on invalid input

**Correct Pattern:**

```ts
export async function getDealsForUser(userId: string) {
  if (!userId) {
    throw new Error("getDealsForUser requires a valid userId")
  }

  // Firestore query
}
```

**Forbidden Pattern:**

```ts
const resolvedUserId = userId ?? auth.currentUser?.uid
```

No hidden fallback resolution. No implicit magic.  
If required data is missing, fail loudly.  

Silence is corruption.

---

### 3. Data Layer (Firestore)

**Rules:**
- All queries must declare scope explicitly.
- User-scoped data must filter by `userId`.
- Admin-level access must use dedicated functions.

**User-Scoped Example:**

```ts
where("userId", "==", userId)
```

**Admin Example:**

```ts
getAllDealsForAdmin()
```

No accidental global reads.  
No mixed-scope queries.

---

### 4. Security Enforcement

Security exists in two places only:

1. Firebase Security Rules (true enforcement)
2. UI route/component guards (UX enforcement)

Business logic must not rely on UI for trust.  
Firestore rules are the final authority.

---

## System Laws

### Law 1: Auth Is Resolved Once — At The Edge

Authentication is handled only in the UI/Auth provider layer.  
Business logic must remain unaware of Firebase Auth internals.

---

### Law 2: Business Logic Is Pure

All core functions must:
- Accept explicit identifiers
- Validate required arguments
- Throw on invalid input
- Contain no hidden global state

Determinism over convenience.

---

### Law 3: No Implicit Fallbacks

No automatic fallback to auth context.  
No silent returns.  
No guessing.

If a caller fails to pass required data, the caller is incorrect.  
Fix the caller.

---

### Law 4: Predictable Flow

Every feature must follow this pipeline:

Auth Resolve  
→ Role Check  
→ Call Pure Function  
→ Firestore Query  
→ Return Data  
→ UI Render  

No shortcuts.

---

### Law 5: Consistency Over Cleverness

If a pattern exists, reuse it.  
Do not invent new access styles per feature.

Consistency reduces cognitive load and prevents architectural drift.

---

## Design Intent

This CRM is not a prototype.  
It is a production system designed for:

- Role-based dashboards  
- Tender lifecycle management  
- AI-assisted workflows  
- Audit logging  
- Real-time Firestore updates  

Architecture discipline today prevents scaling pain tomorrow.

---

## Pull Request Standard

Any pull request that introduces:

- Hidden authentication resolution  
- Implicit identity fallback  
- Global Firestore reads  
- Mixed responsibility logic  

Must be rejected.

---

End of Doctrine.