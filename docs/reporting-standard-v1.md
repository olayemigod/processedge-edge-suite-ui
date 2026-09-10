# EdgeSuite Reporting Standard V1

## Goal

Provide one shared, product-neutral reporting contract for VetEdge, RetailEdge, EduEdge, AgricEdge and future EdgeSuite apps without forcing all reports into one backend implementation.

## Provider modes

### Query Report provider

Use for small/simple reports that can safely execute through the existing Frappe Query Report path.

Characteristics:
- no claim of server-side pagination;
- normalized columns/rows/summary/chart payload;
- optional separate export handler.

### Paginated provider

Use for large, high-use or low-data-sensitive reports where the backend query itself is bounded at query level.

Characteristics:
- server-side `start` / `page_length` contract;
- `supports_query_level_pagination = true`;
- `pagination_strategy = "query-level"`;
- default and hard maximum page length;
- summary and chart loaders independent from interactive row pagination where needed;
- full export is a separate handler and must not require the browser to fetch every page.

### Bounded paginated provider

Use when a product backend safely materializes a complete filtered dataset under a hard server cap and then returns one browser page from that bounded result. This is a valid transitional or naturally bounded pattern, but it is not query-level pagination.

Characteristics:
- server returns one interactive page at a time;
- `supports_server_pagination = true` because the browser receives bounded pages;
- `supports_query_level_pagination = false`;
- `pagination_strategy = "bounded-materialized"`;
- the product must declare `maxDatasetRows` when constructing the provider;
- the backend remains responsible for enforcing that declared cap before or during materialization;
- full export remains a separate bounded handler and must not make the browser loop through pages.

A response that slices an already-materialized full dataset must use this bounded mode rather than the optimized paginated provider. The distinction prevents a safe bounded implementation from being misrepresented as a high-volume query-level reference.

## Standard and Advanced reporting tiers

EdgeSuite supports product-owned subscription classification without owning subscription policy.

Every consuming product should classify its report and dashboard resources as one of:

- `standard` — operational reporting included in the normal product reporting capability;
- `advanced` — management, financial, performance, intelligence, risk, comparison, forecasting, exception or other premium reporting that requires an additional product/platform entitlement.

Recommended product metadata:

- `tier`: `standard` or `advanced`;
- `feature_key`: product/platform subscription feature key when the tier is Advanced;
- `reason`: optional stable classification reason for administration/audit;
- `scope_type`: `report` or `dashboard`;
- `scope_name`: stable product resource key.

The tier is **not authorization by itself**. Effective access should be calculated by the product as:

`product/platform entitlement + normal report/dashboard view permission + branch/company/tenant/practitioner scope + action permission for Print/Export where applicable`.

Rules for consuming apps:

1. EdgeSuite shells may display tier/access metadata supplied by the product, but must never infer entitlement themselves.
2. Standard reports still require normal product/Frappe permission and scope checks.
3. Advanced reports and dashboards must be revalidated server-side before view/data extraction, Print, Export, scheduling or other premium actions.
4. A hidden or disabled Advanced UI control is not a security boundary.
5. Unknown/unclassified resources should default to the product's documented compatibility policy. A safe migration pattern is to default new operational resources to Standard until deliberately classified, rather than accidentally breaking existing deployments.
6. Shared-hosted/white-label products should use the platform subscription/feature service where available. Standalone products may use a local product setting as a compatibility entitlement source.
7. The subscription tier must not weaken ordinary branch/company/tenant/role permissions.

This allows VetEdge, RetailEdge, EduEdge and other apps to package reporting differently while preserving one EdgeSuite presentation standard.

## Shared runtime

The shared EdgeSuite runtime exposes:

- `EdgeSuiteReports.registerProvider(product, key, provider)`;
- `EdgeSuiteReports.getProvider(product, key)`;
- `EdgeSuiteReports.hasProvider(product, key)`;
- `EdgeSuiteReports.listProviders(product)`;
- `EdgeSuiteReports.createQueryReportProvider(...)`;
- `EdgeSuiteReports.createPaginatedReportProvider(...)`;
- `EdgeSuiteReports.createBoundedPaginatedReportProvider(...)`;
- `EdgeSuiteReports.normalizePayload(...)`.

Providers are registered under a stable product + report key so product apps keep ownership of business logic and permissions while EdgeSuite owns the interaction contract.

## Reporting presentation shells

The provider/runtime contract is intentionally separate from page presentation. EdgeSuite exposes two different shared shells rather than one large optional reporting surface.

### `EdgeReportShell`

Use for filtered row-oriented reports. It standardizes:
- page header and report actions;
- filter placement while leaving business filters product-owned;
- summary cards and optional chart placement;
- loading, error and empty states;
- result count and metadata placement;
- reporting table framing;
- page-size and previous/next pagination controls.

`EdgeReportTable` provides reporting-specific table behaviour including numeric alignment, common number/currency/percent formatting, sticky headings, wide-table scrolling and opt-in clickable cells for product-owned drill-down actions.

The shell never loads report data itself. Product code resolves a provider or another permission-aware report service and supplies the resulting state to the shell.

### `EdgeDashboardShell`

Use for decision-oriented dashboards. It standardizes the dashboard header, context/filter area, KPI cards, loading/error treatment and responsive workspace framing while keeping dashboard composition flexible.

`EdgeDashboardGrid` and `EdgeDashboardSection` provide reusable responsive composition for charts, exception panels, ranked lists, compact tables and other product-owned widgets.

A dashboard is not forced into the Report Provider row/column model. Individual dashboard widgets may use report providers or dedicated KPI/chart/exception providers and may load independently.

## Export Builder foundation

The shared runtime also exposes `EdgeReportExportDialog` and `EdgeSuiteReportExport`.

Supported initial formats:
- XLSX;
- CSV;
- PDF.

Supported data scopes:
- current page;
- all filtered records.

Presentation options:
- summary cards;
- filters used;
- charts where the product export provider supports chart rendering;
- letterhead;
- report title;
- generated date/user;
- totals/subtotals;
- selected columns;
- PDF orientation and repeated table headings.

If all presentation options are disabled, the normalized export contract sets `raw_table_only = true`. Product export providers must then emit only the table headings and row data.

The shared client validates generated downloads before saving them. Empty responses, HTML/error bodies masquerading as files, invalid PDF signatures, invalid XLSX package signatures and mismatched MIME types are rejected instead of being downloaded as apparently corrupt files.

## Performance requirements

- Do not load an entire master dataset to populate Link filters.
- Use bounded, permission-aware remote search for large Link fields.
- Large/high-use reports should use server filtering and query-level pagination where practical.
- Bounded-materialized reports must declare and enforce a hard dataset cap and must not be described as query-level paginated.
- Summary cards and charts must not require downloading the complete interactive table into the browser.
- Dashboard widgets may load independently so one slow chart or exception source does not require blocking the complete dashboard.
- No continuous polling by the shared report or dashboard presentation runtime.
- Full export remains separate from interactive pagination; exporting all rows must not make the browser iterate every page.
- Current-page export should use the same bounded page query rather than materializing the complete filtered result merely to slice one page.
- Large all-filtered exports should use a product-defined safe threshold and, where necessary, chunked or queued generation rather than holding a web worker and large Python dataset indefinitely.
- Product backends remain responsible for branch/company/tenant/role enforcement.

## Safety

The reporting runtime and presentation shells are read-oriented infrastructure. They must not:

- bypass Frappe permissions;
- call product databases or APIs directly;
- mutate submitted accounting documents;
- perform stock/payment/clinical mutations;
- infer access merely from UI state;
- infer subscription entitlement merely from a Standard/Advanced label;
- suppress browser security warnings to disguise invalid generated files.

Product apps remain authoritative for filters, permissions, branch/company/tenant scope, subscription entitlement, report calculations, drill-down routes, export extraction and dashboard business semantics.

## VetEdge reference consumers

VetEdge PR #47 consumes this standard progressively using the implementations already present after PR #36:

- Stock Expiry Monitor is the canonical query-level paginated reference;
- Planned Treatment now uses query-level detail-row pagination with separate aggregates while preserving the scoped consultation parent resolver;
- VetEdge Report Center resolves shared providers first, falls back to the existing Query Report path, and consumes the shared Export Builder;
- VetEdge maintains a centralized reporting catalog that classifies Standard and Advanced reports/dashboards and maps Advanced resources to the `advanced_reports` entitlement.

Do not rebuild these reports merely to adopt the shared contract. Adapt them incrementally and preserve existing behaviour.

## Remaining V1 work

The shared client and presentation contracts are present. Product apps still own server-side report extraction, subscription enforcement and document generation. Remaining acceptance work includes:

- representative browser QA of report/dashboard shells;
- real XLSX/CSV/PDF/Print QA including raw/presentation/letterhead combinations;
- export-provider coverage and safe large-export thresholds for optimized high-volume reports;
- browser/network/server measurements against product performance budgets;
- reusable saved export presets in the later intelligence phase.
