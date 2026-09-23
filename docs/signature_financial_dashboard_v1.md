# EdgeSuite Signature Financial Dashboard v1

This component is the shared presentation contract for product financial dashboards.

- `EdgeFinancialDashboard` owns composition, states, metric presentation, the single Smart Date control, drill event emission, and print/export shell integration.
- Product apps own authorised data providers, Company/Branch authority, cost visibility, accounting definitions, thresholds, dimensions, and destination translation.
- Payloads use `schema_version: 1`. Restricted values must be omitted or marked restricted server-side; the shared component never grants capabilities.
- Metric `basis` is explicit: `period`, `current`, `invoice_cohort`, or `as_of`.
- Composition uses a donut only for non-negative part-to-whole data. Signed values automatically render as bars beside the same detail table.
- Action descriptors are presentation-only and must use an allowlisted kind (`page`, `report`, `route`). Product adapters remain responsible for permission-aware navigation.

The component deliberately contains no ERPNext DocType knowledge and no product-specific finance calculations.


## Delivery lineage

Authoritative lineage: stacked on EdgeSuite UI PR #24 exact head `133bdd60f87eea9d834e9697c15847ebed393048`. The shared financial component is additive and product-neutral; consumer apps remain authoritative for permissions and financial definitions.
