# EdgeSuite Desk Access Management

## Purpose

EdgeSuite Desk Access Management separates everyday operational users from advanced users who need the native Frappe/ERPNext Desk.

This capability is an **additional interface-exposure layer**. It does not replace, relax, mirror, or reimplement Frappe/ERPNext permissions, User Permissions, Page/Report permissions, Company or Branch scope, workflow authorization, or product-specific backend validation.

## Access modes

Authenticated users resolve to one of three server-derived modes:

- `native_desk` — the user may use native Frappe/ERPNext Desk surfaces as well as EdgeSuite pages;
- `edgesuite_only` — the user is already a valid Frappe System User, but normal navigation is limited to verified EdgeSuite UI pages;
- `website` — Guest or Website User behavior remains under normal Frappe website/portal rules.

`Administrator` and users with `System Manager` always resolve to `native_desk` as an administrative recovery boundary.

## Per-user access selector

The tenant-facing control is a custom field on `User`:

`EdgeSuite Desk Access`

Available values are:

- `EdgeSuite Only`
- `Native Desk + EdgeSuite`

The field defaults to `EdgeSuite Only` for newly created users after the feature is installed.

The selector is deliberately **not a role** and **not a permission grant**. It only controls interface exposure after Frappe has already determined that the account is a System User.

Changing this selector must not:

- convert a Website User into a System User;
- add or remove roles;
- change Role Profiles;
- grant access to any DocType, Report, Page, Company, Branch, workflow, accounting record, clinical record, academic record, stock record, payment record, or other business object;
- bypass ERPNext/Frappe authorization;
- become a second source of business permissions.

A user reaches EdgeSuite operational pages only if their existing business roles and permissions already authorize the underlying operations.

## Why this is not implemented as a role

Frappe Role Profiles can repopulate a user's direct role rows during User validation. A per-user advanced/everyday distinction implemented as an additional marker role could therefore drift when Role Profiles are changed or the User is saved.

Using a dedicated User field keeps this presentation choice independent of the role system and prevents normal permission maintenance from silently changing Desk exposure.

## Tenant administration and rollout

For an existing tenant after this feature is deployed:

1. migration creates the `EdgeSuite Desk Access` field;
2. a one-time migration backfills existing enabled System Users to `Native Desk + EdgeSuite` so deployment does not unexpectedly remove their current native Desk access;
3. first-time installation on an already populated site performs the same preservation step immediately during installation;
4. an administrator reviews users and changes everyday operational users to `EdgeSuite Only`;
5. advanced users remain `Native Desk + EdgeSuite`;
6. new System Users default to `EdgeSuite Only` unless explicitly elevated, except `Administrator` and `System Manager` which retain recovery access.

Normal later migrations only ensure that the custom field exists. They do **not** re-backfill all System Users, because doing so would overwrite tenant decisions made after rollout.

Changing the selector changes only native-Desk visibility. The user's normal roles, Role Profiles, User Permissions and product authorization remain independently managed.

## Rolling-deploy safety

If new application code is deployed before the database migration has created the custom field, existing System Users temporarily resolve to `native_desk` rather than being locked out.

After migration creates the field and the one-time preservation patch completes, the configured per-user selector becomes authoritative for interface exposure.

This temporary compatibility behavior affects presentation only and does not alter backend authorization.

## Runtime behavior for EdgeSuite-only users

EdgeSuite operational pages are themselves hosted inside Frappe Desk, so the implementation cannot block `/app` or `/desk` globally.

Instead, the shared runtime:

- cloaks native Desk content while a route is being evaluated;
- recognizes native Form, List, Query Report, Report Builder, Tree, Workspace, Dashboard and Print route families as native Desk surfaces;
- classifies the route before trusting DOM state, so a stale EdgeSuite shell left behind during SPA navigation cannot approve a native route;
- approves a non-native route only after a real EdgeSuite shell/page marker renders;
- tolerates delayed product-bundle/page mounting with bounded retries;
- redirects a rejected native route to the last verified or currently registered visible EdgeSuite Page when available;
- shows an EdgeSuite-only fail-closed screen with Reload and Log out when no safe landing page is available;
- hides native Workspace sidebars, Desk home/search affordances and other obvious native-navigation entry points for restricted users;
- filters native DocType, Report and Workspace entries from EdgeSuite product menus for restricted users;
- filters native-route menu entries from shared `EdgeAppShell` navigation.

Product-menu entries are used only to find a practical fallback EdgeSuite landing page. They are **not** an authorization source. Browser storage of the last approved page is navigation convenience only.

## Security boundary

The browser guard is a presentation/access-experience control. It must never be treated as data authorization.

Every server request remains subject to the existing Frappe/ERPNext and product-owned permission checks. A user who manipulates browser JavaScript must not gain any additional data or mutation authority because this feature does not modify those backend permission rules.

The implementation therefore follows two independent gates:

1. **Business authorization** — existing Frappe/ERPNext roles, Role Profiles, permissions, User Permissions and product rules decide whether an operation or record is allowed.
2. **Interface exposure** — EdgeSuite Desk Access Management decides whether an already-authorized System User may navigate the native Desk UI or is kept in EdgeSuite operational pages.

Both gates must pass where applicable. The interface-exposure gate never overrides or broadens the business-authorization gate.

## Multi-app behavior

The capability belongs to the shared EdgeSuite UI app installed on each product site. It has no CoreEdge dependency and does not move product authorization into the shared frontend.

A multi-app site therefore has one local advanced/everyday Desk distinction while each installed product continues to own its business permissions and visible EdgeSuite menu definitions.

## Administrative behavior

Tenant administrators manage the selector from the User record. Because the control concerns System User administration, it is placed at User permission level 1 and is shown only for System Users.

A change takes effect on the user's next refreshed Desk boot/session context. Saving the User continues to use Frappe's normal User lifecycle and cache invalidation.

## Validation requirements

Before release, verify at minimum:

- first-time installation on a populated site preserves existing enabled System Users as `Native Desk + EdgeSuite`;
- upgrade migration preserves existing enabled System Users as `Native Desk + EdgeSuite` exactly once;
- later migrations do not overwrite tenant-selected access levels;
- the selector is a User field and does not add, remove or mutate roles or Role Profiles;
- a Website User remains a Website User regardless of the selector value;
- a new ordinary System User defaults to `EdgeSuite Only`;
- changing the selector restores/removes native Desk visibility without changing business roles;
- direct native List/Form/Query Report/Workspace routes do not become visible to EdgeSuite-only users;
- a stale EdgeSuite shell cannot authorize a newly selected native route during SPA navigation;
- native DocType/Report/Workspace entries are omitted from restricted EdgeSuite menus;
- delayed EdgeSuite page mounting is accepted without false redirect;
- an unauthorized backend request remains denied regardless of the UI mode;
- Administrator/System Manager recovery remains available;
- VetEdge, RetailEdge, EduEdge, EdgePay and CoreEdge consumer compatibility continues against the same authoritative EdgeSuite UI release candidate.
