const DEFAULT_EXPORT_FORMATS = Object.freeze([
  Object.freeze({ value: "csv", label: "CSV" }),
  Object.freeze({ value: "excel", label: "Excel" }),
  Object.freeze({ value: "print", label: "Print / PDF" }),
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function scalarText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function spreadsheetSafeText(value) {
  const text = scalarText(value);
  if (typeof value !== "string") return text;
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function escapeHtml(value) {
  return scalarText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeCsv(value) {
  const text = spreadsheetSafeText(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function sanitizeFilename(value) {
  const cleaned = scalarText(value || "report")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return cleaned || "report";
}

function inferColumns(rows) {
  const first = rows.find((row) => row && typeof row === "object" && !Array.isArray(row));
  if (!first) return [];
  return Object.keys(first).map((fieldname) => ({ fieldname, label: fieldname }));
}

function normalizeColumns(columns, rows) {
  const source = asArray(columns).length ? asArray(columns) : inferColumns(rows);
  return source
    .filter((column) => column && column.hidden !== true && column.hidden !== 1)
    .map((column) => {
      if (typeof column === "string") return { fieldname: column, label: column };
      const fieldname = scalarText(column.fieldname || column.key || column.name).trim();
      return {
        ...column,
        fieldname,
        label: scalarText(column.label || fieldname).trim() || fieldname,
      };
    })
    .filter((column) => column.fieldname);
}

function normalizeNamedValues(value) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((entry) => ({
        label: scalarText(entry.label || entry.key || entry.fieldname).trim(),
        value: entry.value,
      }))
      .filter((entry) => entry.label && entry.value !== "" && entry.value !== null && entry.value !== undefined);
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .filter(([, entryValue]) => entryValue !== "" && entryValue !== null && entryValue !== undefined)
    .map(([label, entryValue]) => ({ label, value: entryValue }));
}

export function normalizeExportDataset(dataset = {}) {
  const rows = asArray(dataset.rows);
  const summary = normalizeNamedValues(dataset.summary);
  const normalizedRows = rows.length
    ? rows
    : summary.map((entry) => ({ metric: entry.label, value: entry.value }));
  const columns = rows.length
    ? normalizeColumns(dataset.columns, rows)
    : summary.length
      ? [
          { fieldname: "metric", label: "Metric" },
          { fieldname: "value", label: "Value" },
        ]
      : normalizeColumns(dataset.columns, rows);

  const title = scalarText(dataset.title || "Report").trim() || "Report";
  return {
    title,
    filename: sanitizeFilename(dataset.filename || title),
    columns,
    rows: normalizedRows,
    filters: normalizeNamedValues(dataset.filters),
    summary,
    metadata: normalizeNamedValues(dataset.metadata),
    generatedAt: dataset.generatedAt || new Date().toISOString(),
  };
}

function cellValue(row, column) {
  if (typeof column.value === "function") return column.value(row, column);
  return row?.[column.fieldname];
}

export function buildCsv(dataset) {
  const normalized = normalizeExportDataset(dataset);
  const header = normalized.columns.map((column) => escapeCsv(column.label)).join(",");
  const lines = normalized.rows.map((row) =>
    normalized.columns.map((column) => escapeCsv(cellValue(row, column))).join(","),
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

function renderNamedValues(entries, className) {
  if (!entries.length) return "";
  return `<dl class="${className}">${entries
    .map(
      (entry) =>
        `<div><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(spreadsheetSafeText(entry.value))}</dd></div>`,
    )
    .join("")}</dl>`;
}

function renderTable(normalized) {
  if (!normalized.columns.length) return "<p>No tabular data available.</p>";
  const head = normalized.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = normalized.rows
    .map(
      (row) =>
        `<tr>${normalized.columns
          .map((column) => `<td>${escapeHtml(spreadsheetSafeText(cellValue(row, column)))}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function documentHtml(normalized, { printable = false } = {}) {
  const filters = renderNamedValues(normalized.filters, "edge-export-filters");
  const summary = renderNamedValues(normalized.summary, "edge-export-summary");
  const metadata = renderNamedValues(normalized.metadata, "edge-export-metadata");
  const generated = escapeHtml(normalized.generatedAt);
  const printScript = printable
    ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),50));<\/script>'
    : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(normalized.title)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #172b4d; margin: 24px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .generated { color: #667085; font-size: 11px; margin-bottom: 16px; }
  dl { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 10px 0 16px; }
  dl div { min-width: 160px; }
  dt { color: #667085; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  dd { margin: 2px 0 0; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #d0d5dd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f2f4f7; font-weight: 700; }
  @media print { body { margin: 0; } thead { display: table-header-group; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${escapeHtml(normalized.title)}</h1>
<div class="generated">Generated ${generated}</div>
${metadata}${filters}${summary}${renderTable(normalized)}
${printScript}
</body>
</html>`;
}

export function buildExcelHtml(dataset) {
  return documentHtml(normalizeExportDataset(dataset));
}

export function buildPrintableHtml(dataset) {
  return documentHtml(normalizeExportDataset(dataset), { printable: true });
}

function downloadText(content, mimeType, filename, target = globalThis) {
  const documentTarget = target?.document;
  const BlobCtor = target?.Blob || globalThis.Blob;
  const urlApi = target?.URL || globalThis.URL;
  if (!documentTarget || !BlobCtor || !urlApi?.createObjectURL) {
    throw new Error("File download is unavailable in this runtime.");
  }
  const blob = new BlobCtor([content], { type: mimeType });
  const url = urlApi.createObjectURL(blob);
  const anchor = documentTarget.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  documentTarget.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => urlApi.revokeObjectURL(url), 0);
}

function openPrintPreview(html, target = globalThis) {
  const popup = target?.open?.("", "_blank", "noopener,noreferrer");
  if (!popup) throw new Error("Allow pop-ups to use Print / PDF export.");
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

async function resolveDataset(dataset, loadDataset) {
  if (typeof loadDataset !== "function") return normalizeExportDataset(dataset);
  const loaded = await loadDataset();
  return normalizeExportDataset({ ...(dataset || {}), ...(loaded || {}) });
}

export async function exportDataset({ format, dataset = {}, loadDataset = null, target = globalThis } = {}) {
  const normalizedFormat = scalarText(format).trim().toLowerCase();
  if (!DEFAULT_EXPORT_FORMATS.some((entry) => entry.value === normalizedFormat)) {
    throw new Error(`Unsupported export format: ${normalizedFormat || "unknown"}`);
  }
  const resolved = await resolveDataset(dataset, loadDataset);
  if (normalizedFormat === "csv") {
    downloadText(buildCsv(resolved), "text/csv;charset=utf-8", `${resolved.filename}.csv`, target);
  } else if (normalizedFormat === "excel") {
    downloadText(
      buildExcelHtml(resolved),
      "application/vnd.ms-excel;charset=utf-8",
      `${resolved.filename}.xls`,
      target,
    );
  } else {
    openPrintPreview(buildPrintableHtml(resolved), target);
  }
  return { format: normalizedFormat, rowCount: resolved.rows.length, filename: resolved.filename };
}

export const EDGE_EXPORT_FORMATS = DEFAULT_EXPORT_FORMATS;

export const edgeExportAdapter = Object.freeze({
  formats: EDGE_EXPORT_FORMATS,
  normalizeDataset: normalizeExportDataset,
  buildCsv,
  buildExcelHtml,
  buildPrintableHtml,
  exportDataset,
});
