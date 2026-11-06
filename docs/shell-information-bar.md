# Shared shell information bar

The compact strip above the EdgeSuite product header replaces the duplicate native page heading while an EdgeSuite shell is focused. Native Desk pages retain their original heading. This is a shared-shell QA correction on the current release-authority candidate, preserving the v16 upgrade and responsive SmartDate predecessors.

## Native Desk access

Back to Desk is shown only when the existing server boot contract `edgesuite_ui_access` has both `mode: native_desk` and `can_use_native_desk: true`. Unknown, Website and EdgeSuite-only contexts fail closed. No roles or user access settings are changed. The target is the native `/desk` Desktop home, verified in Chrome against the pinned v16.52 runtime. It lets the user choose an authorised native workspace. A plain native link preserves the browser/Frappe navigation and unsaved-work handling. Existing document-specific Advanced actions keep their exact-document responsibilities.

## News and communications space

The region is always reserved, including for users without native Desk access. With no message it stays blank and does not announce an empty placeholder to screen readers. Existing personal notifications continue to use native Notification Log through EdgeSuite's current notification adapter.

Supply `{title, message}` through the shared `EdgeAppShell.communication` prop or the optional `frappe.boot.edgesuite_ui_communication` boot payload. Text is rendered as escaped text, with wrapping and polite live-region semantics. HTML, arbitrary links and a publication workflow are outside this bounded slice. A future provider must resolve tenant, product, Company, Branch, user/role audience and publication dates on the server before returning content. Browser filtering is never an authorisation boundary; no client broadcast store or parallel message database is introduced here.

## Research and native reuse

- Exact platform: Frappe 16.52.0 / ERPNext 16.51.1 on Python 3.14 / Node 24, as recorded in the RetailEdge candidate manifest.
- Reuse the current `edgesuite_ui.access_control.get_access_context` boot contract, the public native `/desk` Desktop route. Do not infer Desk exposure from frontend roles or import private Framework UI modules.
- Native v16.52 routes `/desk` to Desktop and builds allowed Workspaces from server boot. The existing Frappe/ERPNext permission system remains authoritative on arrival.
- Native page/layout integration and shared EdgeSuite button/theme tokens already cover this small header surface; no copied framework component or new icon library is needed.
- [Carbon notification guidance](https://www.carbondesignsystem.com/building-blocks/core/components/notification/code) distinguishes non-disruptive inline/callout information from transient toasts. Apply that principle to a quiet persistent information region with no rotation, pop-up, focus stealing or fabricated news.
- [Pinned Frappe Desk source](https://github.com/frappe/frappe/blob/v16.52.0/frappe/public/js/frappe/desk.js), [router](https://github.com/frappe/frappe/blob/v16.52.0/frappe/public/js/frappe/router.js) and the existing shared notification/access contracts informed the implementation.

## Validation

The new browser regressions fail before implementation and pass afterwards: allowed/restricted/unknown/Website access, native heading restoration, light/dark themes, narrow widths and escaped communication content. Run them in the required browser workflow alongside existing navigation, theme, access and printing-dialog checks. Rebuild and validate direct RetailEdge consumption against the exact final shared candidate before promotion; keep the existing draft/manual-QA gates.

The strip styles and scoped native heading suppression ship in the hashed shared CSS bundle, so existing browser sessions receive them with the new runtime build.
