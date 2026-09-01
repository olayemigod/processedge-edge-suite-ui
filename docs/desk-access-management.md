# EdgeSuite Desk Access Management

## Purpose

EdgeSuite Desk Access Management separates everyday operational users from advanced users who need the native Frappe/ERPNext Desk.

This capability is an **additional interface-exposure layer**. It does not replace or relax Frappe/ERPNext permissions, User Permissions, Page/Report permissions, Company or Branch scope, workflow authorization, or product-specific backend validation.

## Access modes

Authenticated users resolve to one of three server-derived modes:

- `native_desk` — the user may use native Frappe/ERPNext Desk surfaces as well as EdgeSuite pages;
- `edgesuite_only` — the user is a Frappe System User, but normal navigation is limited to verified EdgeSuite UI pages;
- `website` — Guest or Website User behavior remains under normal Frappe website/portal rules.

`Administrator` and users with `System Manager` always resolve to `native_desk` as an administrative recovery boundary.

## Marker role

The managed role is:

`EdgeSuite Advanced Desk User`

The role is deliberately created with `desk_access = 0` and no DocType permissions.

This is important because the role must **not**:

- convert a Website User into a System User;
- grant access to any DocType, Report, Page, Company, Branch, workflow, accounting record, clinical record, academic record, stock record, or payment record;
- bypass ERPNext/Frappe authorization;
- become a second source of business permissions.

A user reaches EdgeSuite operational pages only if their existing business roles already make them a valid System User and their existing permissions authorize the underlying operations.

## Tenant administration

For an existing tenant after this feature is deployed:

1. migration creates the `EdgeSuite Advanced Desk User` marker role;
2. a one-time patch assigns it to existing enabled System Users so deployment does not unexpectedly remove their current native Desk access;
3. an administrator reviews users and removes the marker role from everyday operational users;
4. advanced users retain the marker role;
5. new System Users are EdgeSuite-only unless the marker is explicitly assigned, except `Administrator` and `System Manager`.

Removing or assigning this role changes only native-Desk visibility. The user's normal business roles and User Permissions must still be managed independently.

## Runtime behavior for EdgeSuite-only users

EdgeSuite operational pages are themselves hosted inside Frappe Desk, so the implementation cannot block `/app` globally.

Instead, the shared runtime:

- cloaks native Desk content while a route is being evaluated;
- recognizes native Form, List, Query Report, Report Builder, Tree, Workspace, Dashboard and Print route families as native Desk surfaces;
- approves a route only after a real EdgeSuite shell/page marker renders;
- tolerates delayed product-bundle/page mounting with bounded retries;
- redirects a rejected native route to the last verified or currently registered visible EdgeSuite Page when available;
- shows an EdgeSuite-only fail-closed screen with Reload and Log out when no safe landing page is available;
- hides native Workspace sidebars, Desk home/search affordances and other obvious native-navigation entry points for restricted users.

Product-menu entries are used only to find a practical fallback EdgeSuite landing page. They are **not** an authorization source. Browser storage of the last approved page is also navigation convenience only.

## Security boundary

The browser guard is a presentation/access-experience control. It must never be treated as data authorization.

Every server request remains subject to the existing Frappe/ERPNext and product-owned permission checks. A user who manipulates browser JavaScript must not gain any additional data or mutation authority because this feature does not modify those backend permission rules.

The implementation therefore follows two independent gates:

1. **Business authorization** — existing Frappe/ERPNext roles, permissions, User Permissions and product rules decide whether an operation or record is allowed.
2. **Interface exposure** — EdgeSuite Desk Access Management decides whether an already-authorized System User may navigate the native Desk UI or is kept in EdgeSuite operational pages.

Both gates must pass where applicable; the second gate never overrides the first.

## Multi-app behavior

The capability belongs to the shared EdgeSuite UI app installed on each product site. It has no CoreEdge dependency and does not move product authorization into the shared frontend.

A multi-app site therefore has one local advanced/everyday Desk distinction while each installed product continues to own its business permissions and visible EdgeSuite menu definitions.

## Validation requirements

Before release, verify at minimum:

- existing enabled System Users preserve native Desk access immediately after migration;
- the marker role has `desk_access = 0` and no permission grants;
- a new ordinary System User without the marker is EdgeSuite-only;
- assigning the marker restores native Desk visibility without changing business roles;
- removing the marker does not remove valid EdgeSuite operations already permitted by business roles;
- direct native List/Form/Query Report/Workspace routes do not become visible to EdgeSuite-only users;
- delayed EdgeSuite page mounting is accepted without false redirect;
- an unauthorized backend request remains denied regardless of the UI mode;
- Administrator/System Manager recovery remains available;
- VetEdge, RetailEdge, EduEdge, EdgePay and CoreEdge consumer compatibility continues against the same authoritative EdgeSuite UI release candidate.
