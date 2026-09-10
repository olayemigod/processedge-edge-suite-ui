# EdgeSuite Smart Reporting Dates

`EdgeSmartDateRange` is a product-neutral reporting filter primitive for human-friendly date expressions and custom date ranges. It is intended for reports, dashboards, action centres, appointment/expiry views and similar read/filter contexts.

## Safety boundary

Smart-date interpretation is convenience, not business authority. Product APIs receive only the resolved exact `from_date` and `to_date` values. Accounting posting dates, stock dates, clinical dates, academic dates, permissions and workflow decisions remain server-authoritative.

The control always shows the resolved exact range. Ambiguous numeric expressions require explicit user confirmation.

## One hybrid Date control

Products should expose one visible Date selector rather than separate Smart Date, From Date and To Date controls.

The same `EdgeSmartDateRange` supports both paths:

- a user can type or choose a smart period such as `last 90 days` or `this month`;
- EdgeSuite resolves the phrase to exact dates and populates the selector's current range;
- opening the range selector shows those exact dates in the custom From/To controls;
- the user can then adjust either date manually and apply a custom range;
- smart periods and custom ranges emit the same exact `from_date` / `to_date` contract.

This means there is only one visible date authority in product UI while server queries continue to receive exact dates.

## Supported expressions

Examples include:

- `today`, `yesterday`, `tomorrow`
- `this week`, `last week`, `next week`
- `this month`, `last month`, `next month`
- `this quarter`, `last quarter`, `next quarter`
- `this year`, `last year`, `next year`
- `last 30 days`, `past 14 days`, `next 7 days`
- `last 4 weeks`, `next 2 weeks`
- `YTD`, `MTD`, `QTD`
- `Q2 2026`
- `Aug 2026`, `August 2026`
- ISO dates such as `2026-08-21`
- locale-ordered numeric dates such as `21/08/2026`

The shared selector also provides common quick-period presets including Today, Yesterday, This Week, Last Week, This Month, Last Month, Last 7 Days, Last 30 Days, Last 90 Days and YTD.

## User-visible interpretation

A valid phrase resolves to an exact period, for example:

`Interpreted as: 01-07-2026 – 31-07-2026`

The exact selected range remains visible in the selector. When the user opens the custom range picker, its From and To fields are populated with the same resolved dates. This allows the user to start with a smart period and then fine-tune it manually without switching to another date control.

For an ambiguous expression such as `03/04/26`, the component may display the interpreted date but does not emit the filter value until the user confirms the configured DMY/MDY convention.

## Product integration

Use `EdgeSmartDateRange` as the single visible Date filter inside an `EdgeReportShell`, `EdgeDashboardShell`, action centre or equivalent product filter area. Listen for `resolved` or `update:modelValue`, then map the emitted exact values onto the product API's existing date field names.

Example smart-period value:

```js
{
  expression: "last month",
  from_date: "2026-07-01",
  to_date: "2026-07-31",
  label: "2026-07-01 – 2026-07-31"
}
```

Example custom-range value:

```js
{
  expression: "custom",
  from_date: "2026-07-05",
  to_date: "2026-07-27",
  label: "2026-07-05 – 2026-07-27"
}
```

The product remains responsible for permission checks, branch/company/tenant scope, query filtering and any date-domain validation.
