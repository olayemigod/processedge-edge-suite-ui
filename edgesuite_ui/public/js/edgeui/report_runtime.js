const REPORT_RUNTIME_VERSION = "1.2.0";
const PROVIDER_KINDS = Object.freeze({
  QUERY: "query-report",
  PAGINATED: "paginated",
  BOUNDED_PAGINATED: "bounded-paginated",
});
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

function requiredFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`EdgeSuite report provider requires ${name}().`);
  }
  return value;
}

function optionalExportHandler(exportReport) {
  return typeof exportReport === "function" ? exportReport : null;
}

function normalizeColumns(columns = []) {
  return (Array.isArray(columns) ? columns : []).map((column, index) => {
    if (typeof column === "string") {
      const [label, fieldname, fieldtype, width] = column.split(":");
      return {
        label: label || `Column ${index + 1}`,
        fieldname: fieldname || `column_${index + 1}`,
        fieldtype: fieldtype || "Data",
        width: Number(width || 0) || undefined,
      };
    }
    return {
      ...column,
      label: column?.label || column?.fieldname || column?.key || `Column ${index + 1}`,
      fieldname: column?.fieldname || column?.key || `column_${index + 1}`,
      fieldtype: column?.fieldtype || column?.type || "Data",
    };
  });
}

function normalizeRows(rows = [], columns = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return sourceRows.map((row) => {
    if (!Array.isArray(row)) return row || {};
    return Object.fromEntries(columns.map((column, index) => [column.fieldname, row[index]]));
  });
}

function normalizeSort(sort = null) {
  if (!sort || typeof sort !== "object") return null;
  const field = String(sort.field || sort.fieldname || sort.key || "").trim();
  const direction = String(sort.direction || sort.order || "").trim().toLowerCase();
  if (!field || !SORT_DIRECTIONS.has(direction)) return null;
  return { field, direction };
}

function sortableColumn(columns = [], field = "") {
  return columns.find((column) => column?.fieldname === field && column?.sortable !== false) || null;
}

function comparableValue(value, column = {}) {
  if (value === null || value === undefined || value === "") return { empty: true, value: null };
  const fieldtype = String(column.fieldtype || column.type || "").toLowerCase();
  if (["currency", "float", "int", "percent", "number", "check"].includes(fieldtype)) {
    const number = Number(value);
    return Number.isFinite(number) ? { empty: false, value: number } : { empty: false, value: String(value) };
  }
  if (["date", "datetime", "time"].includes(fieldtype)) {
    const timestamp = Date.parse(String(value));
    return Number.isFinite(timestamp) ? { empty: false, value: timestamp } : { empty: false, value: String(value) };
  }
  return { empty: false, value: String(value).toLocaleLowerCase() };
}

function sortMaterializedRows(rows = [], columns = [], sort = null) {
  const normalized = normalizeSort(sort);
  if (!normalized) return rows;
  const column = sortableColumn(columns, normalized.field);
  if (!column) return rows;
  const factor = normalized.direction === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = comparableValue(left.row?.[normalized.field], column);
      const b = comparableValue(right.row?.[normalized.field], column);
      if (a.empty && b.empty) return left.index - right.index;
      if (a.empty) return 1;
      if (b.empty) return -1;
      let comparison = 0;
      if (typeof a.value === "string" || typeof b.value === "string") {
        comparison = String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: "base" });
      } else if (a.value < b.value) comparison = -1;
      else if (a.value > b.value) comparison = 1;
      return comparison ? comparison * factor : left.index - right.index;
    })
    .map(({ row }) => row);
}

export function normalizeReportPayload(payload = {}, request = {}) {
  const columns = normalizeColumns(payload.columns || []);
  const rows = normalizeRows(payload.rows || payload.result || [], columns);
  const start = Number(payload.start ?? request.start ?? 0) || 0;
  const pageLength = Number(payload.page_length ?? request.page_length ?? rows.length ?? 0) || 0;
  const total = Number(payload.total ?? payload.total_count ?? rows.length ?? 0) || 0;
  return {
    columns,
    rows,
    summary: payload.summary || payload.report_summary || [],
    chart: payload.chart || null,
    total,
    start,
    page_length: pageLength,
    has_previous: start > 0,
    has_next: start + rows.length < total,
    sort: normalizeSort(payload.sort || request.sort),
    metadata: payload.metadata || {},
  };
}

export function createQueryReportProvider({ reportName, run, exportReport = null } = {}) {
  if (!reportName) throw new TypeError("EdgeSuite query report provider requires reportName.");
  requiredFunction(run, "run");
  const exportHandler = optionalExportHandler(exportReport);
  return Object.freeze({
    kind: PROVIDER_KINDS.QUERY,
    reportName,
    supports_server_pagination: false,
    supports_query_level_pagination: false,
    supports_sorting: true,
    sorting_strategy: "materialized",
    pagination_strategy: "materialized",
    async load({ filters = {}, sort = null } = {}) {
      const normalizedSort = normalizeSort(sort);
      const payload = await run({ reportName, filters, sort: normalizedSort });
      const normalized = normalizeReportPayload(payload || {}, { sort: normalizedSort });
      normalized.rows = sortMaterializedRows(normalized.rows, normalized.columns, normalizedSort);
      normalized.sort = normalizedSort;
      return normalized;
    },
    export: exportHandler,
    exportReport: exportHandler,
  });
}

export function createPaginatedReportProvider({
  key,
  loadPage,
  loadSummary = null,
  loadChart = null,
  exportReport = null,
  defaultPageLength = 50,
  maxPageLength = 200,
} = {}) {
  if (!key) throw new TypeError("EdgeSuite paginated report provider requires key.");
  requiredFunction(loadPage, "loadPage");
  const defaultLength = Math.max(1, Number(defaultPageLength || 50));
  const maximumLength = Math.max(defaultLength, Number(maxPageLength || defaultLength));
  const exportHandler = optionalExportHandler(exportReport);

  return Object.freeze({
    kind: PROVIDER_KINDS.PAGINATED,
    key,
    supports_server_pagination: true,
    supports_query_level_pagination: true,
    supports_sorting: true,
    sorting_strategy: "server",
    pagination_strategy: "query-level",
    default_page_length: defaultLength,
    max_page_length: maximumLength,
    async load({ filters = {}, start = 0, page_length = defaultLength, sort = null } = {}) {
      const safeStart = Math.max(0, Number(start || 0));
      const safeLength = Math.min(maximumLength, Math.max(1, Number(page_length || defaultLength)));
      const normalizedSort = normalizeSort(sort);
      const pagePromise = loadPage({ filters, start: safeStart, page_length: safeLength, sort: normalizedSort });
      const summaryPromise = typeof loadSummary === "function" ? loadSummary({ filters }) : null;
      const chartPromise = typeof loadChart === "function" ? loadChart({ filters }) : null;
      const [page, summary, chart] = await Promise.all([pagePromise, summaryPromise, chartPromise]);
      const normalized = normalizeReportPayload(page || {}, { start: safeStart, page_length: safeLength, sort: normalizedSort });
      if (summary !== null && summary !== undefined) normalized.summary = summary?.summary || summary || [];
      if (chart !== null && chart !== undefined) normalized.chart = chart?.chart || chart || null;
      return normalized;
    },
    export: exportHandler,
    exportReport: exportHandler,
  });
}

export function createBoundedPaginatedReportProvider({
  key,
  loadPage,
  exportReport = null,
  defaultPageLength = 50,
  maxPageLength = 200,
  maxDatasetRows,
} = {}) {
  if (!key) throw new TypeError("EdgeSuite bounded paginated report provider requires key.");
  requiredFunction(loadPage, "loadPage");
  const datasetLimit = Number(maxDatasetRows || 0);
  if (!Number.isFinite(datasetLimit) || datasetLimit < 1) {
    throw new TypeError("EdgeSuite bounded paginated report provider requires maxDatasetRows > 0.");
  }
  const defaultLength = Math.max(1, Number(defaultPageLength || 50));
  const maximumLength = Math.max(defaultLength, Number(maxPageLength || defaultLength));
  const exportHandler = optionalExportHandler(exportReport);

  return Object.freeze({
    kind: PROVIDER_KINDS.BOUNDED_PAGINATED,
    key,
    supports_server_pagination: true,
    supports_query_level_pagination: false,
    supports_sorting: true,
    sorting_strategy: "server",
    pagination_strategy: "bounded-materialized",
    max_dataset_rows: datasetLimit,
    default_page_length: defaultLength,
    max_page_length: maximumLength,
    async load({ filters = {}, start = 0, page_length = defaultLength, sort = null } = {}) {
      const safeStart = Math.max(0, Number(start || 0));
      const safeLength = Math.min(maximumLength, Math.max(1, Number(page_length || defaultLength)));
      const normalizedSort = normalizeSort(sort);
      const page = await loadPage({ filters, start: safeStart, page_length: safeLength, sort: normalizedSort });
      return normalizeReportPayload(page || {}, { start: safeStart, page_length: safeLength, sort: normalizedSort });
    },
    export: exportHandler,
    exportReport: exportHandler,
  });
}

function providerKey(product, reportKey) {
  const productKey = String(product || "").trim().toLowerCase();
  const key = String(reportKey || "").trim();
  if (!productKey || !key) throw new TypeError("EdgeSuite report provider requires product and report key.");
  return `${productKey}:${key}`;
}

export function createReportProviderRegistry() {
  const providers = new Map();
  return Object.freeze({
    register(product, reportKey, provider) {
      if (!provider || typeof provider.load !== "function") {
        throw new TypeError("EdgeSuite report provider must expose load().");
      }
      const key = providerKey(product, reportKey);
      providers.set(key, provider);
      return provider;
    },
    unregister(product, reportKey) {
      return providers.delete(providerKey(product, reportKey));
    },
    get(product, reportKey) {
      return providers.get(providerKey(product, reportKey)) || null;
    },
    has(product, reportKey) {
      return providers.has(providerKey(product, reportKey));
    },
    list(product = "") {
      const prefix = product ? `${String(product).trim().toLowerCase()}:` : "";
      return [...providers.entries()]
        .filter(([key]) => !prefix || key.startsWith(prefix))
        .map(([key, provider]) => ({ key, kind: provider.kind || "custom" }));
    },
  });
}

export function installEdgeSuiteReportRuntime(runtime, target = globalThis) {
  if (!runtime) return null;
  if (runtime.reports?.version === REPORT_RUNTIME_VERSION) return runtime.reports;
  const registry = createReportProviderRegistry();
  const reports = Object.freeze({
    version: REPORT_RUNTIME_VERSION,
    kinds: PROVIDER_KINDS,
    registerProvider: registry.register,
    unregisterProvider: registry.unregister,
    getProvider: registry.get,
    hasProvider: registry.has,
    listProviders: registry.list,
    createQueryReportProvider,
    createPaginatedReportProvider,
    createBoundedPaginatedReportProvider,
    normalizePayload: normalizeReportPayload,
    normalizeSort,
    sortMaterializedRows,
  });
  runtime.reports = reports;
  if (target) {
    target.EdgeSuiteReports = reports;
    target.dispatchEvent?.(new target.CustomEvent("edgesuite:report-runtime-ready", { detail: { version: REPORT_RUNTIME_VERSION } }));
  }
  return reports;
}

export { REPORT_RUNTIME_VERSION, PROVIDER_KINDS, normalizeSort, sortMaterializedRows };
