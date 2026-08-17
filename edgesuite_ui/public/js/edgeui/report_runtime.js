const REPORT_RUNTIME_VERSION = "1.0.0";
const PROVIDER_KINDS = Object.freeze({
  QUERY: "query-report",
  PAGINATED: "paginated",
});

function requiredFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`EdgeSuite report provider requires ${name}().`);
  }
  return value;
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
    metadata: payload.metadata || {},
  };
}

export function createQueryReportProvider({ reportName, run, exportReport = null } = {}) {
  if (!reportName) throw new TypeError("EdgeSuite query report provider requires reportName.");
  requiredFunction(run, "run");
  return Object.freeze({
    kind: PROVIDER_KINDS.QUERY,
    reportName,
    supports_server_pagination: false,
    async load({ filters = {} } = {}) {
      const payload = await run({ reportName, filters });
      return normalizeReportPayload(payload || {});
    },
    export: typeof exportReport === "function" ? exportReport : null,
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

  return Object.freeze({
    kind: PROVIDER_KINDS.PAGINATED,
    key,
    supports_server_pagination: true,
    default_page_length: defaultLength,
    max_page_length: maximumLength,
    async load({ filters = {}, start = 0, page_length = defaultLength } = {}) {
      const safeStart = Math.max(0, Number(start || 0));
      const safeLength = Math.min(maximumLength, Math.max(1, Number(page_length || defaultLength)));
      const pagePromise = loadPage({ filters, start: safeStart, page_length: safeLength });
      const summaryPromise = typeof loadSummary === "function" ? loadSummary({ filters }) : null;
      const chartPromise = typeof loadChart === "function" ? loadChart({ filters }) : null;
      const [page, summary, chart] = await Promise.all([pagePromise, summaryPromise, chartPromise]);
      const normalized = normalizeReportPayload(page || {}, { start: safeStart, page_length: safeLength });
      if (summary !== null && summary !== undefined) normalized.summary = summary?.summary || summary || [];
      if (chart !== null && chart !== undefined) normalized.chart = chart?.chart || chart || null;
      return normalized;
    },
    export: typeof exportReport === "function" ? exportReport : null,
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
    normalizePayload: normalizeReportPayload,
  });
  runtime.reports = reports;
  if (target) target.EdgeSuiteReports = reports;
  return reports;
}

export { REPORT_RUNTIME_VERSION, PROVIDER_KINDS };
