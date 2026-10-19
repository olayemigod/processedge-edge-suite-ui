# Shared EdgeButton primitive — 2026-10-19

## Baseline

ProcessEdge product surfaces currently reuse EdgeSuite `edge-button` styling, but EdgeSuite does not expose a semantic button component. Product pages therefore fall back to raw `<button>` markup for ordinary actions.

The supported ProcessEdge platform baseline is Frappe/ERPNext v16.50. Frappe UI exposes a reusable `Button` component with solid/subtle/outline/ghost variants and treats buttons as shared UI primitives rather than page-local markup. Classic Frappe Desk likewise provides supported button APIs for Desk-native pages/forms.

## Decision

Add a small `EdgeButton` primitive to EdgeSuite and register it in the normal runtime component registry. It will:

- use the existing EdgeSuite `edge-button` classes and design tokens;
- support primary/secondary/outline/ghost/danger variants without introducing product-specific styling;
- support button type, disabled state, loading state, accessible label/title, and default-slot or label content;
- emit a normal `click` event and suppress clicks while disabled/loading;
- remain a presentation primitive only, with no business or permission logic.

Product apps should consume `EdgeButton` for ordinary EdgeSuite actions instead of creating new raw-button variants. Existing specialized controls and native Frappe Desk button APIs remain unchanged.

## Deliberate boundary

This does not import `frappe-ui` directly into EdgeSuite. The current EdgeSuite runtime already provides its own compatibility layer and CSS contract; directly adopting a newer external component package would expand dependency/runtime scope beyond this maintenance slice. The API follows the native reusable-button pattern while preserving the pinned EdgeSuite runtime and theme contract.

## Validation

The shared contract must verify runtime registration, supported variants, disabled/loading behavior, accessible attributes, and continued use of EdgeSuite theme classes. RetailEdge Customer 360 is the first consumer in the current QA-convergence slice.