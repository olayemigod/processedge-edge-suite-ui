const GET_PROFILES_METHOD = "edgesuite_ui.api.printing.get_active_print_profiles";
const RESOLVE_PROFILE_METHOD = "edgesuite_ui.api.printing.resolve_print_profile";

function callFrappe(target, method, args = {}) {
  return new Promise((resolve, reject) => {
    if (!target?.frappe?.call) {
      reject(new Error("Frappe print profile API is unavailable."));
      return;
    }
    target.frappe.call({
      method,
      args,
      callback(response) {
        resolve(response?.message ?? null);
      },
      error(error) {
        reject(error);
      },
    });
  });
}

function scalar(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function integer(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function utf8Encode(value) {
  return new TextEncoder().encode(String(value ?? ""));
}

function asciiSafeText(value) {
  return String(value ?? "")
    .replaceAll("₦", "NGN")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?");
}

export function textEncoderFromProfile(profile) {
  const normalized = normalizePrintProfile(profile);
  if (!normalized || normalized.textEncoding === "utf-8") return utf8Encode;
  return (value) => utf8Encode(asciiSafeText(value));
}

export function normalizePrintProfile(profile = null) {
  if (!profile || typeof profile !== "object") return null;
  const name = scalar(profile.name || profile.profileName || profile.profile_name).trim();
  if (!name) return null;

  return Object.freeze({
    name,
    profileName: scalar(profile.profileName || profile.profile_name || name).trim() || name,
    purpose: scalar(profile.purpose || "Receipt"),
    productKey: scalar(profile.productKey ?? profile.product_key).trim(),
    scopeType: scalar(profile.scopeType || profile.scope_type || "Global"),
    scopeValue: scalar(profile.scopeValue ?? profile.scope_value).trim(),
    priority: integer(profile.priority, 0),
    transport: scalar(profile.transport || "Serial").toLowerCase(),
    protocol: scalar(profile.protocol || "ESC/POS"),
    paperWidth: integer(profile.paperWidth ?? profile.paper_width, 80),
    charactersPerLine: integer(profile.charactersPerLine ?? profile.characters_per_line, 48),
    baudRate: integer(profile.baudRate ?? profile.baud_rate, 9600),
    textEncoding: scalar(profile.textEncoding ?? profile.text_encoding ?? "ASCII Safe")
      .trim()
      .toLowerCase()
      .replaceAll(" ", "-"),
    autoCut: Boolean(Number(profile.autoCut ?? profile.auto_cut) || profile.autoCut === true || profile.auto_cut === true),
    cutMode: scalar(profile.cutMode || profile.cut_mode || "Partial").toLowerCase(),
    cashDrawer: Boolean(Number(profile.cashDrawer ?? profile.cash_drawer) || profile.cashDrawer === true || profile.cash_drawer === true),
    drawerPin: integer(profile.drawerPin ?? profile.drawer_pin, 0),
    feedLines: integer(profile.feedLines ?? profile.feed_lines, 3),
    copies: Math.max(1, integer(profile.copies, 1)),
    printLogo: Boolean(Number(profile.printLogo ?? profile.print_logo) || profile.printLogo === true || profile.print_logo === true),
    printQr: Boolean(Number(profile.printQr ?? profile.print_qr) || profile.printQr === true || profile.print_qr === true),
  });
}

export function receiptDocumentOptionsFromProfile(profile) {
  const normalized = normalizePrintProfile(profile);
  if (!normalized) return null;
  return Object.freeze({
    paper: normalized.paperWidth,
    charactersPerLine: normalized.charactersPerLine,
    feedLines: normalized.feedLines,
    copies: normalized.copies,
    autoCut: normalized.autoCut,
    cutMode: normalized.cutMode,
    cashDrawer: normalized.cashDrawer,
    drawerPin: normalized.drawerPin,
    printLogo: normalized.printLogo,
    printQr: normalized.printQr,
  });
}

export function connectionOptionsFromProfile(profile) {
  const normalized = normalizePrintProfile(profile);
  if (!normalized) return null;
  return normalized.transport === "serial"
    ? Object.freeze({ openOptions: Object.freeze({ baudRate: normalized.baudRate }) })
    : Object.freeze({});
}

export function createPrintProfileClient({ target = globalThis } = {}) {
  async function list(context = {}) {
    const response = await callFrappe(target, GET_PROFILES_METHOD, {
      purpose: context.purpose || "Receipt",
      product_key: context.productKey || context.product_key || "",
      company: context.company || "",
      branch: context.branch || "",
    });
    return (Array.isArray(response) ? response : [])
      .map(normalizePrintProfile)
      .filter(Boolean);
  }

  async function resolve(context = {}) {
    const response = await callFrappe(target, RESOLVE_PROFILE_METHOD, {
      purpose: context.purpose || "Receipt",
      product_key: context.productKey || context.product_key || "",
      company: context.company || "",
      branch: context.branch || "",
    });
    return normalizePrintProfile(response);
  }

  return Object.freeze({
    list,
    resolve,
    normalize: normalizePrintProfile,
    receiptOptions: receiptDocumentOptionsFromProfile,
    connectionOptions: connectionOptionsFromProfile,
    textEncoder: textEncoderFromProfile,
  });
}

export {
  GET_PROFILES_METHOD,
  RESOLVE_PROFILE_METHOD,
};
