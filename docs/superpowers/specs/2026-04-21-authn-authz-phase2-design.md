# AuthN & AuthZ — Phase 2: Access Control Design

**Sub-project 8, Phase 2 — Eggscaliber-Lite**
**Date:** 2026-04-21

---

## Overview

Phase 2 adds group-based package access control on top of the identity stack delivered in Phase 1. Users belong to org-scoped groups; groups are granted access to packages; packages can be public (visible to all) or private (visible only to subscribed orgs whose groups have been granted access). A super-user role manages org subscriptions and package composition via an in-app admin panel.

---

## Data Model

### Breaking migration: `collection.package_id` removed

Collections currently have a direct `package_id` FK (one-to-many). Phase 2 replaces this with a many-to-many join so a collection can belong to multiple packages. The migration must:

1. Create the `package_collections` table (see below)
2. Migrate all existing `(collection.package_id, collection.id)` pairs into `package_collections` rows with `scope = 'all'`
3. Drop `collection.package_id`

### New and modified tables

```sql
-- Modify packages
ALTER TABLE package ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
-- 'public' | 'private'

-- Replace collection.package_id with a join table
package_collections
  package_id     INT NOT NULL REFERENCES package(id) ON DELETE CASCADE
  collection_id  INT NOT NULL REFERENCES collection(id) ON DELETE CASCADE
  scope          TEXT NOT NULL DEFAULT 'all'   -- 'all' | 'selected'
  PRIMARY KEY (package_id, collection_id)

-- Dataset-level inclusions (only rows when scope = 'selected')
package_collection_datasets
  package_id     INT NOT NULL
  collection_id  INT NOT NULL
  dataset_id     INT NOT NULL REFERENCES dataset(id) ON DELETE CASCADE
  FOREIGN KEY (package_id, collection_id) REFERENCES package_collections(package_id, collection_id)
  PRIMARY KEY (package_id, collection_id, dataset_id)

-- Org subscriptions to private packages
org_subscriptions
  id          SERIAL PRIMARY KEY
  org_id      INT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE
  package_id  INT NOT NULL REFERENCES package(id) ON DELETE CASCADE
  start_date  DATE NOT NULL
  end_date    DATE                          -- NULL = no expiry
  created_at  TIMESTAMPTZ DEFAULT now()
  UNIQUE (org_id, package_id)

-- Org-scoped groups
groups
  id         SERIAL PRIMARY KEY
  org_id     INT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE
  name       TEXT NOT NULL
  is_default BOOLEAN NOT NULL DEFAULT false
  UNIQUE (org_id, name)

-- One default group per org (enforced in application layer on org creation)

group_memberships
  group_id   INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  PRIMARY KEY (group_id, user_id)

group_packages
  group_id    INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE
  package_id  INT NOT NULL REFERENCES package(id) ON DELETE CASCADE
  PRIMARY KEY (group_id, package_id)
```

### Access rule

A user can access a package if **either**:
- `package.visibility = 'public'`
- `package.visibility = 'private'` AND an `org_subscriptions` row exists for the user's org and package where `start_date <= now()` AND (`end_date IS NULL` OR `end_date >= now()`) AND the user belongs to at least one group with a matching `group_packages` row

A user with no group memberships (other than Default) sees only public packages.

---

## Auth Layer

### `CurrentUser` extension

```python
@dataclass
class CurrentUser:
    clerk_id: str
    email: str
    org_id: str | None
    is_superuser: bool = False   # True when JWT public_metadata.role == "superuser"
```

`get_current_user` reads `payload.get("public_metadata", {}).get("role") == "superuser"` to set the flag. In `AUTH_MODE=dev`, a `DEV_SUPERUSER=true` env var flips `is_superuser` for local admin testing; otherwise it defaults to `False`. When `org_id` is `None` in dev mode, `get_accessible_package_ids` returns all packages.

### `get_accessible_package_ids` dependency

```python
async def get_accessible_package_ids(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> set[int] | None:
    if settings.auth_mode == "dev":
        return None   # unrestricted in dev
    if current_user.is_superuser:
        return None   # unrestricted for superuser
    return await package_repo.get_accessible_ids(session, current_user)
```

`package_repo.get_accessible_ids` runs a single SQL query that unions:
- All package IDs where `visibility = 'public'`
- All package IDs where the user's org has an active subscription (date-bounded) AND the user is in at least one group with access

The query uses OR logic across groups — a user in multiple groups gets the union of all packages those groups have access to.

---

## Webhook Changes

Three additional actions on existing webhook events:

**`organization.created`** → after upserting the org, create a Default group:
```python
await group_repo.create_default_group(session, org_id=org.id)
```

**`organizationMembership.deleted`** → after deleting from `org_memberships`, also delete all `group_memberships` rows for that user within groups belonging to that org:
```python
await group_repo.remove_user_from_org_groups(session, user_id=user.id, org_id=org.id)
```

**`organizationMembership.created`** → after upserting the membership, add the user to the org's Default group:
```python
await group_repo.add_user_to_default_group(session, user_id=user.id, org_id=org.id)
```

---

## API Endpoints

### Existing routes — changes

All data routes (`/packages`, `/collections`, `/datasets`, `/analytics`, `/ai`) gain:
```python
current_user: CurrentUser = Depends(get_current_user)
accessible_ids: set[int] | None = Depends(get_accessible_package_ids)
```

Routes that return package-scoped data pass `accessible_ids` to the service layer. Services apply the filter: `None` = no filter; `set[int]` = restrict to those IDs.

**Analytics and AI input validation:** Before executing any analytics or AI query, the service resolves the `package_id` for the requested `collection_id` / `dataset_id` and asserts it is within `accessible_ids`. Returns `403` if not. This prevents crafted requests from bypassing package-level filtering.

**AI service:** `ai_service` receives `accessible_ids` and restricts its data source selection to accessible packages only. It must not query collections or datasets outside the accessible set.

### New group management routes

All require `current_user: CurrentUser = Depends(get_current_user)`. The service layer verifies the group's `org_id` matches `current_user.org_id`; returns `403` otherwise. Org role checks (admin-only operations) compare against the `org_memberships.role` field.

```
POST   /api/v1/groups                                  create group (admin only)
GET    /api/v1/groups                                  list groups for current user's org
DELETE /api/v1/groups/{group_id}                       delete group (admin only; cannot delete Default)

POST   /api/v1/groups/{group_id}/members               add user to group (admin only)
DELETE /api/v1/groups/{group_id}/members/{user_id}     remove user from group (admin only)

POST   /api/v1/groups/{group_id}/packages              assign package to group (admin only)
DELETE /api/v1/groups/{group_id}/packages/{package_id} remove package from group (admin only)
```

### New admin routes

All require `current_user.is_superuser`; return `403` otherwise.

```
GET    /api/v1/admin/orgs
GET    /api/v1/admin/orgs/{org_id}/subscriptions
POST   /api/v1/admin/orgs/{org_id}/subscriptions         body: { package_id, start_date, end_date? }
DELETE /api/v1/admin/orgs/{org_id}/subscriptions/{package_id}

GET    /api/v1/admin/packages
POST   /api/v1/admin/packages                            create package
PATCH  /api/v1/admin/packages/{package_id}               update name, slug, description, visibility
GET    /api/v1/admin/packages/{package_id}/collections
POST   /api/v1/admin/packages/{package_id}/collections   add collection to package (with scope)
PATCH  /api/v1/admin/packages/{package_id}/collections/{collection_id}   update scope
DELETE /api/v1/admin/packages/{package_id}/collections/{collection_id}

POST   /api/v1/admin/packages/{package_id}/collections/{collection_id}/datasets   add dataset inclusion
DELETE /api/v1/admin/packages/{package_id}/collections/{collection_id}/datasets/{dataset_id}
```

All list endpoints support search, sort, filter, and pagination via query params (`q`, `sort`, `order`, `page`, `page_size`).

---

## Frontend

### `/org/groups`

Accessible to authenticated users. Linked from the nav bar (visible to all org members). Three-panel layout: groups list (left), members panel (centre), packages panel (right). Only org admins can mutate; members can view.

- Groups list: search, sort, paginated. Create/delete buttons visible to admins. Default group cannot be deleted.
- Members panel: shows org members with their role. Admins can add/remove (not from Default — membership is automatic).
- Packages panel: shows packages subscribed by the org. Toggle grants/revokes group access. Private packages not subscribed by the org are not shown.

Gating: Clerk's `useOrganization()` determines role. Mutation controls are hidden/disabled for non-admins.

### `/admin`

No nav link — super-users navigate directly. Gated client-side by calling `GET /api/v1/admin/orgs` on mount; redirect to `/analytics` on `403`.

Two-tab layout:

**Subscriptions tab:** Org list sidebar (search, paginated). For selected org: package table with columns — Package, Subscribed (toggle), Start Date, End Date. Public packages show "auto" for dates; private packages show date inputs that activate when subscribed. All columns sortable; table searchable and paginated.

**Packages tab:** Package list sidebar (search, filter by visibility, paginated). For selected package: visibility badge (click to toggle public/private), collections table with Include toggle, Dataset Scope dropdown (All / Selected), and dataset chip selector when scope = Selected. Collections table is searchable, sortable, and paginated.

---

## Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | User in multiple groups | `get_accessible_package_ids` unions package IDs across all groups (OR logic) |
| 2 | Subscription date enforcement | Access query filters `start_date <= now() AND (end_date IS NULL OR end_date >= now())` |
| 3 | Org member with no group | Only public packages visible. Mitigated by auto-adding new members to the Default group |
| 4 | User leaves org | `organizationMembership.deleted` webhook removes all `group_memberships` rows for that user within that org's groups |
| 5 | Analytics/AI dataset bypass | Service resolves `package_id` for requested `collection_id`/`dataset_id` and asserts it is within `accessible_ids`; returns `403` if not |
| 6 | AI data source selection | `ai_service` receives `accessible_ids` and restricts autonomous data source selection to accessible packages |
| 7 | `AUTH_MODE=dev` with `org_id=None` | `get_accessible_package_ids` returns `None` (all packages) in dev mode |

---

## Testing

### Backend

- **`get_accessible_package_ids` unit tests:** public package visible to all; private package visible only when org subscribed (active date range) and user in a group with access; superuser returns `None`; user in multiple groups gets union; expired subscription denies access
- **Analytics input validation:** crafted request referencing inaccessible `dataset_id` returns `403`
- **Admin endpoints:** `403` when `is_superuser=False`; correct response when `True`
- **Group management endpoints:** `403` when group belongs to a different org; Default group cannot be deleted
- **Webhook tests:** `organization.created` creates Default group; `organizationMembership.created` adds user to Default group; `organizationMembership.deleted` removes all group memberships for that user in that org
- **Migration test:** existing `collection.package_id` data correctly migrated to `package_collections` rows

### Frontend (Playwright E2E)

- Org admin creates a group, adds a member, assigns a private package
- User not in any group (beyond Default) sees only public packages and Default group's packages
- Super-user subscribes an org to a private package with a start date; access denied before start date
- User removed from org loses access to private packages
- Non-admin org member cannot mutate groups (controls hidden/disabled)

---

## Implementation Notes

- The Default group `is_default = true` flag prevents deletion via the API and signals the webhook handler
- `package_collections.scope` and `package_collection_datasets` only affect dataset-level visibility within analytics queries — the package itself remains accessible; only the dataset rows available within a collection are filtered
- Subscription date comparisons use UTC dates
- All new list endpoints use a consistent pagination envelope: `{ items, total, page, page_size }`
