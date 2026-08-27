# EdgeSuite Report and Dashboard Export Contract

EdgeSuite UI owns report/dashboard export behavior so product apps do not implement CSV, Excel, or Print/PDF generation independently.

## Shared capability

The EdgeSuite runtime exposes:

- `EdgeExportMenu` component
- `window.EdgeSuiteUI.getAdapter("export")` programmatic adapter
- CSV export
- Excel export
- Print / PDF browser flow

The export runtime handles:

- filename normalization
- UTF-8 CSV generation
- spreadsheet-formula injection protection
- HTML escaping for Excel/print output
- report filters and summary metadata
- summary-only dashboards by converting cards to a Metric/Value dataset
- on-demand dataset loading for paginated reports

## Product-app responsibility

A product page supplies business data only:

```js
{
  title: "Stock Movement History",
  filename: "Stock Movement History - ITEM-001",
  columns: [
    { fieldname: "posting_datetime", label: "Date / Time" },
    { fieldname: "in_quantity", label: "In Quantity" },
    { fieldname: "out_quantity", label: "Out Quantity" },
  ],
  rows: currentRows,
  filters: [
    { label: "Company", value: company },
    { label: "Warehouse", value: warehouse },
  ],
  summary: [
    { label: "Movement Rows", value: 42 },
  ],
}
```

Use the component:

```vue
<EdgeExportMenu
  :dataset="exportDataset"
  :loadDataset="loadExportDataset"
  @export-error="handleExportError"
/>
```

`loadDataset` is optional. Paginated or lazy reports should use it to request the complete **bounded** filtered dataset only when the user actually selects an export format. Do not preload full report data merely to make the Download button available.

## Performance and security rules

- Keep interactive reports paginated/lazy.
- Export-all endpoints must have an explicit safe server-side row/scan limit.
- Never loop through browser pages when one bounded export query can calculate the dataset once.
- Backend permissions and tenant/company/branch restrictions remain authoritative.
- Product apps must not trust hidden browser filters to authorize exported data.
- Do not place CSV/Excel/PDF generator code in RetailEdge, VetEdge, EduEdge, AgricEdge, or other product apps.
- Product apps may define business-specific columns, filters, summaries, and a bounded loader only.

## Dashboard behavior

For summary-only dashboards, `summary` can be supplied without `rows`; EdgeSuite exports Metric/Value rows automatically. Dashboards with charts should provide the underlying chart dataset when a tabular export is useful. Print / PDF uses the normalized export dataset rather than requiring each product to create its own printable document.
