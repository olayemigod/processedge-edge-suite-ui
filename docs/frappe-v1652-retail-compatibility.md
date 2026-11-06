# Frappe 16.52 / ERPNext 16.51.1 compatibility candidate

This is the bounded successor to the v16.50 canary. It preserves the EdgeSuite
product shell, semantic controls, context, permissions, Smart Date, printing,
draft lifecycle and authorized native Advanced surface. It is not a redesign.

## Exact platform and extension points

- Frappe v16.52.0: `4515014c87ece6cb20ee91d2cfb121c5cbd1ff4a`.
- ERPNext v16.51.1: `5af6561f5aa48104559692fb4fd82f2580e8d338`.
- Python 3.14.4 and Node 24.15.0 in local staging.
- ERPNext declares Frappe `>=16.50.0,<17.0.0`.

Research used the exact tagged native sources, not development-branch examples:
[native UI components](https://github.com/frappe/frappe/tree/v16.52.0/frappe/public/js/frappe/ui/components),
[dock](https://github.com/frappe/frappe/blob/v16.52.0/frappe/public/js/frappe/ui/sidebar/dock.js),
[sidebar](https://github.com/frappe/frappe/blob/v16.52.0/frappe/public/js/frappe/ui/sidebar/sidebar.js),
and [ERPNext requirements](https://github.com/frappe/erpnext/blob/v16.51.1/pyproject.toml).

The existing native Desk adapter delegates Dropdown, ContextMenu and toast to
public `frappe.ui` APIs, with null fallbacks on older builds. These APIs are
present in the pinned production runtime. Native dropdowns already implement
keyboard opening, focus navigation and Escape restoration. No product import
of `@framework/ui`, copied framework markup, or new icon system is introduced.

Existing Vue controls, searchable Links, Date/form semantics, Smart Date,
dialogs, tables, themes and icon fallbacks remain in place. Their wholesale
replacement and private Framework UI adoption remain deferred. The earlier
isolated Frappe UI 1.0 canary is not part of the product asset graph.

## Required navigation repair

Frappe now inserts `#desk-dock` as a sibling of `.body-sidebar-container`.
Suppressing only the sidebar leaves a second native navigation surface beside
the EdgeSuite product shell. Shared CSS now hides that dock only while the
visible product/shared shell requests native navigation suppression.

No native dock state, pin preference, role, permission or document is rewritten.
Returning to native Desk removes the suppression; Frappe decides whether the
dock is enabled on that native route. A disabled native dock must not be forced
visible merely to make a test pass.

The browser regression failed in light and dark mode before the repair, then
passed after it. It also verifies keyboard reachability, delayed dock mounting,
stale hide flags, native hidden state, and products that retain native navigation.

## Local staging evidence

The source retail site was backed up and restored into a separate bench and
database. With EdgeSuite unchanged, two migrations, a full production build,
authenticated Desk/API smoke and accounting/stock ledger fingerprints passed.
No migration or framework change was applied to the working `retail.local`.

For this shared candidate, the 217 Python contract checks, 17 Frappe integration
tests, 19 browser tests, frontend/native-adapter fallback checks, Ruff and the
production EdgeSuite build passed locally. The actual staged Business Hub
detected all three native adapter capabilities without JavaScript page errors,
and native ListView navigation cleared EdgeSuite suppression state.

RetailEdge full-suite/persona validation and online exact-head gates are separate
promotion requirements. Keep the compatibility PR draft until those succeed;
manual `retail.local` QA remains required before RetailEdge PR #226 is ready.
