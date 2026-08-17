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

Use for large, high-use or low-data-sensitive reports where the backend query itself is bounded.

Characteristics:
- server-side `start` / `page_length` contract;
- default and hard maximum page length;
- summary and chart loaders independent from interactive row pagination where needed;
- full export is a separate handler and must not require the browser to fetch every page.

A response that slices an already-materialized full dataset is not considered query-level server pagination. Product integrations should label that state accurately and optimize it before treating it as a high-volume reference.

## Shared runtime

The shared EdgeSuite runtime exposes:

- `EdgeSuiteReports.registerProvider(product, key, provider)`;
- `EdgeSuiteReports.getProvider(product, key)`;
- `EdgeSuiteReports.hasProvider(product, key)`;
- `EdgeSuiteReports.listProviders(product)`;
- `EdgeSuiteReports.createQueryReportProvider(...)`;
- `EdgeSuiteReports.createPaginatedReportProvider(...)`;
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
- Large/high-use reports should use server filtering and query-level pagination.
- Summary cards and charts must not require downloading the complete interactive table.
- Dashboard widgets may load independently so one slow chart or exception source does not require blocking the complete dashboard.
- No continuous polling by the shared report or dashboard presentation runtime.
- Full export remains separate from interactive pagination; exporting all rows must not make the browser iterate every page.
- Product backends remain responsible for branch/company/tenant/role enforcement.

## Safety

The reporting runtime and presentation shells are read-oriented infrastructure. They must not:

- bypass Frappe permissions;
- call product databases or APIs directly;
- mutate submitted accounting documents;
- perform stock/payment/clinical mutations;
- infer access merely from UI state;
- suppress browser security warnings to disguise invalid generated files.

Product apps remain authoritative for filters, permissions, branch/company/tenant scope, report calculations, drill-down routes, export extraction and dashboard business semantics.

## VetEdge reference consumers

VetEdge PR #47 consumes this standard progressively using the implementations already present after PR #36:

- Stock Expiry Monitor is the canonical query-level paginated reference;
- Planned Treatment currently has a paged response but still materializes the full structured report before slicing, so it is explicitly marked optimization-pending rather than a query-level pagination reference;
- VetEdge Report Center resolves shared providers first, falls back to the existing Query Report path, and is the first consumer of the shared Export Builder.

Do not rebuild these reports merely to adopt the shared contract. Adapt them incrementally and preserve existing behaviour.

## Remaining V1 work

The shared client and presentation contracts are now present. Product apps still own server-side report extraction and document generation. Remaining work includes:

- complete browser Print and PDF rendering parity from one paginated print model;
- chart rendering in presentation exports;
- export-provider coverage for optimized high-volume reports;
- browser QA of generated files and the shared report/dashboard shells in representative product consumers;
- reusable saved export presets in the later intelligence phase.

Do not mark Print/PDF complete merely because PDF bytes can be generated; Print and PDF must render from the same report model before that acceptance gate is closed.
