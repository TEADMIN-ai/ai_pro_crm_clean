# TEOS Enterprise Phase 1 Architecture Proposal
**Status:** Draft proposal
**Scope:** Architecture only, no production implementation
**Targets:** Enterprise Shell, Executive Desktop, Operations Desktop, Driver Workspace, Contractor Portal, Client Portal, Division Switching, Workspace Registry, Enterprise Navigation, Universal Search, Shared Services Layer

## 1. Summary
TEOS already has the right primitives for a phase-1 enterprise model: an app-router dashboard shell, a workspace registry, a workspace resolver, role-based access helpers, and reusable domain services under `src/lib/*`.
The proposal is to promote those primitives into a clearer enterprise architecture without breaking current routes.
Keep `/dashboard` as the internal enterprise container, split role-specific desktops into route-scoped workspaces, introduce a registry-driven workspace metadata layer, and centralize shared services.

## 2. Current-State Analysis
### What already exists
- Dashboard layout already provides a persistent shell with sidebar navigation, header, and workspace identity.
- Workspace registry, resolver, and permissions already exist as reusable primitives.
- Role routing already maps users to default entry paths.
- Domain services already exist for deals, contractors, compliance, governance, vehicle finance, AI, and tender handling.
- The dashboard shell is still one shell for many concerns.
- Portal entry points are minimal and not yet role-shaped.
- There is no dedicated enterprise shell boundary for executive, operations, or driver contexts.
- Navigation is workspace-aware only in a narrow sidebar sense.
- Search is not surfaced as a universal cross-workspace affordance.

## 3. Architecture Goal
Create a single enterprise foundation that can host multiple TEOS experiences without duplicating auth, navigation, layout, or domain service logic.

## 4. Proposed Folder Structure
The existing codebase stays intact. The proposal adds clearer enterprise boundaries for shells and shared services.
Recommended structure:
src/app/(enterprise)/dashboard/executive/page.tsx
src/app/(enterprise)/dashboard/operations/page.tsx
src/app/(enterprise)/dashboard/driver/page.tsx
src/app/(enterprise)/dashboard/workspace/[workspaceSlug]/page.tsx
src/app/(portal)/portal/contractor/page.tsx
src/app/(portal)/portal/client/page.tsx
src/components/enterprise/EnterpriseShell.tsx
src/components/enterprise/EnterpriseTopBar.tsx
src/components/enterprise/EnterpriseSideNav.tsx
src/components/enterprise/EnterpriseWorkspaceHeader.tsx
src/components/enterprise/DivisionSwitcher.tsx
src/components/enterprise/UniversalSearch.tsx
src/lib/enterprise/enterpriseRegistry.ts
src/lib/enterprise/enterprisePermissions.ts
src/lib/enterprise/enterpriseRouting.ts
src/lib/enterprise/enterpriseSearch.ts
src/lib/services/shared/

## 5. Reusable Providers
AuthProvider stays the identity source of truth.
WorkspaceProvider resolves active workspace from route or switcher state.
DivisionProvider resolves business division context.
NavigationProvider owns shell navigation state.
SearchProvider owns universal query and result state.
PermissionProvider centralizes workspace and action checks.
ShellPreferencesProvider stores compact mode, pinned workspace, and sidebar state.

## 6. Routing Strategy
Use the dashboard for internal enterprise users and the portal route tree for external users.
/dashboard becomes the enterprise entry point.
/dashboard/executive becomes the executive desktop.
/dashboard/operations becomes the operations desktop.
/dashboard/driver becomes the driver workspace.
/dashboard/workspace/[workspaceSlug] becomes the registry-resolved workspace route.
/portal/contractor and /portal/client become the external portals.
Legacy routes should remain live during migration and redirect only where a compatible target exists.

## 7. Workspace Architecture
Enterprise Shell is the top-level internal container.
Executive Desktop surfaces pipeline health, compliance risk, awards, and exceptions.
Operations Desktop surfaces document queues, workflow queues, validation, and task ownership.
Driver Workspace is constrained, mobile-first, and task-driven.
Contractor Portal is external, narrow, and submission-oriented.
Client Portal is external, narrow, and delivery-oriented.
Division Switching changes context, not authentication.

## 8. Permission Model
Use layered permissions: authentication, role, division, workspace, then action.
Internal shells should support admin, manager, staff, and specialist roles as appropriate.
Executive Desktop should allow read-heavy access for admin, manager, and auditor roles.
Operations Desktop should allow admin, manager, staff, and assigned operators.
Driver Workspace should allow driver plus privileged internal support.
Contractor Portal should remain contractor-scoped.
Client Portal should remain client-scoped.

## 9. Service Boundaries
UI components should consume view models only.
Shared services should transform domain records into shell-ready summaries.
Domain services should remain in existing lib modules and own business rules.
Candidate shared services include identity, navigation, permissions, documents, workflow, search, audit, and notifications.
The shared layer should orchestrate, not own, domain behavior.

## 10. Migration Strategy
Phase 1 should be a composition layer over the current app, not a rewrite.
Introduce enterprise shell components alongside the current dashboard shell.
Add registry metadata for enterprise desktops and portals.
Move current dashboard sections into route-specific workspaces.
Keep legacy dashboard routes active as compatibility wrappers.
Add universal search and division switching after routing is stable.
Migrate page-local data shaping into the shared services layer over time.

## 11. Recommended Order
1. Enterprise Shell
2. Workspace Registry
3. Enterprise Navigation
4. Executive Desktop
5. Operations Desktop
6. Division Switching
7. Universal Search
8. Driver Workspace
9. Contractor Portal
10. Client Portal
11. Shared Services Layer extraction

## 12. Decision
Phase 1 should be built as a composition layer over the current app, not a rewrite.
The codebase already contains enough workspace, role, and domain primitives to support the new shells with controlled migration and minimal disruption.
The next deliverable should be a shell design spec plus a registry schema before any production code is introduced.
