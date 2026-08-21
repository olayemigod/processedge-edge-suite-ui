# EdgeSuite Smart Reporting Dates

`EdgeSmartDateRange` is a product-neutral reporting filter primitive for human-friendly date expressions. It is intended for reports, dashboards, action centres, appointment/expiry views and similar read/filter contexts.

## Safety boundary

Smart-date interpretation is convenience, not business authority. Product APIs receive only the resolved exact `from_date` and `to_date` values. Accounting posting dates, stock dates, clinical dates, academic dates, permissions and workflow decisions remain server-authoritative.

The control always shows the resolved interpretation before it is applied. Ambiguous numeric expressions require explicit user confirmation.

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

## User-visible interpretation

A valid phrase renders a message such as:

`Interpreted as: 2026-07-01 – 2026-07-31`

Products should retain this resolved label in the active filter summary so users can always see the exact period represented by the report or dashboard.

For an ambiguous expression such as `03/04/26`, the component may display the interpreted date but does not emit the filter value until the user confirms the configured DMY/MDY convention.

## Product integration

Use `EdgeSmartDateRange` inside the `EdgeReportShell` or `EdgeDashboardShell` filter area. Listen for `resolved` or `update:modelValue`, then map the emitted exact values onto the product report's existing date field names.

Example emitted value:

```js
{
  expression: "last month",
  from_date: "2026-07-01",
  to_date: "2026-07-31",
  label: "2026-07-01 – 2026-07-31"
}
```

The product remains responsible for permission checks, branch/company/tenant scope, query filtering and any date-domain validation.
