# EdgeSuite UI

EdgeSuite UI is the independent, versioned user-interface runtime for ProcessEdge product applications.

It is intentionally separated from CoreEdge. Product applications such as VetEdge and RetailEdge install and serve EdgeSuite UI locally, so their operational pages remain usable when the central CoreEdge platform is unavailable.

## Architectural rules

- EdgeSuite UI must not import files from CoreEdge or any product application.
- Product applications own their pages, workflows, data access, and product bundles.
- EdgeSuite UI owns shared visual tokens, reusable Vue components, the application mounting contract, and Frappe Desk integration.
- CoreEdge is an optional platform-service provider. Platform context is injected through adapters rather than imported into the UI runtime.
- Runtime assets are served locally from the installed `edgesuite_ui` Frappe app.
- `window.EdgeSuiteUI` is the canonical browser namespace.
- `window.EdgeUI` is retained as a temporary compatibility alias during migration.

## Initial package layout

```text
edgesuite_ui/
  hooks.py
  public/
    css/edgeui.bundle.css
    js/edgeui.bundle.js
  tests/
docs/
```

## Initial migration sequence

1. Establish the standalone runtime and asset contract in this repository.
2. Port the current shared components from CoreEdge without product or platform coupling.
3. Install EdgeSuite UI beside VetEdge and migrate one VetEdge page as the reference integration.
4. Migrate RetailEdge pages.
5. Remove the legacy EdgeUI asset delivery from CoreEdge after all consumers have moved.

## Status

Foundation implementation is in progress.
