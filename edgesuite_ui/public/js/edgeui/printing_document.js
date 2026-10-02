const PAPER_PROFILES = Object.freeze({
  58: Object.freeze({ widthMm: 58, charactersPerLine: 32 }),
  80: Object.freeze({ widthMm: 80, charactersPerLine: 48 }),
});

const BLOCK_TYPES = new Set([
  "text",
  "rule",
  "row",
  "feed",
  "qr",
  "barcode",
  "image",
  "cut",
  "drawer",
]);

function integer(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function normalizeAlign(value, fallback = "left") {
  const normalized = String(value || fallback).trim().toLowerCase();
  return ["left", "center", "right"].includes(normalized) ? normalized : fallback;
}

function normalizeTextBlock(block) {
  return Object.freeze({
    type: "text",
    text: String(block.text ?? block.value ?? ""),
    align: normalizeAlign(block.align),
    bold: Boolean(block.bold),
    width: integer(block.width, 1, { min: 1, max: 8 }),
    height: integer(block.height, 1, { min: 1, max: 8 }),
    wrap: block.wrap !== false,
  });
}

function normalizeRuleBlock(block, charactersPerLine) {
  const char = String(block.char || "-").slice(0, 1) || "-";
  return Object.freeze({
    type: "rule",
    char,
    length: integer(block.length, charactersPerLine, { min: 1, max: charactersPerLine }),
  });
}

function normalizeColumns(columns, charactersPerLine) {
  const source = Array.isArray(columns) ? columns : [];
  if (!source.length) throw new TypeError("Receipt row blocks require at least one column.");

  const requested = source.map((column) => ({
    text: String(column?.text ?? column?.value ?? ""),
    align: normalizeAlign(column?.align),
    width: integer(column?.width, 0, { min: 0, max: charactersPerLine }),
  }));
  const fixed = requested.reduce((sum, column) => sum + column.width, 0);
  if (fixed > charactersPerLine) {
    throw new RangeError("Receipt row column widths exceed the paper profile.");
  }

  const flexible = requested.filter((column) => column.width === 0);
  let remaining = charactersPerLine - fixed;
  return Object.freeze(
    requested.map((column, index) => {
      if (column.width) return Object.freeze(column);
      const flexRemaining = flexible.filter((entry) => entry.width === 0).length;
      const width = Math.max(1, Math.floor(remaining / Math.max(1, flexRemaining)));
      remaining -= width;
      flexible.shift();
      const isLastFlexible = !requested.slice(index + 1).some((entry) => entry.width === 0);
      return Object.freeze({
        ...column,
        width: isLastFlexible ? width + remaining : width,
      });
    }),
  );
}

function normalizeRowBlock(block, charactersPerLine) {
  return Object.freeze({
    type: "row",
    columns: normalizeColumns(block.columns, charactersPerLine),
    gap: integer(block.gap, 0, { min: 0, max: 4 }),
    bold: Boolean(block.bold),
  });
}

function normalizeBinaryImage(block) {
  const width = integer(block.width, 0, { min: 1, max: 4096 });
  const height = integer(block.height, 0, { min: 1, max: 4096 });
  if (!width || !height) throw new TypeError("Receipt image blocks require positive width and height.");
  const bytesPerRow = Math.ceil(width / 8);
  const expectedLength = bytesPerRow * height;
  const data = block.data instanceof Uint8Array ? block.data : Uint8Array.from(block.data || []);
  if (data.byteLength !== expectedLength) {
    throw new RangeError(
      `Receipt image data must contain exactly ${expectedLength} packed monochrome bytes.`,
    );
  }
  return Object.freeze({
    type: "image",
    width,
    height,
    data,
    align: normalizeAlign(block.align, "center"),
  });
}

function normalizeBlock(block, charactersPerLine) {
  if (!block || typeof block !== "object") throw new TypeError("Receipt blocks must be objects.");
  const type = String(block.type || "").trim().toLowerCase();
  if (!BLOCK_TYPES.has(type)) throw new TypeError(`Unsupported receipt block type: ${type || "unknown"}`);

  if (type === "text") return normalizeTextBlock(block);
  if (type === "rule") return normalizeRuleBlock(block, charactersPerLine);
  if (type === "row") return normalizeRowBlock(block, charactersPerLine);
  if (type === "image") return normalizeBinaryImage(block);
  if (type === "feed") {
    return Object.freeze({ type, lines: integer(block.lines, 1, { min: 1, max: 20 }) });
  }
  if (type === "qr") {
    const value = String(block.value ?? block.text ?? "");
    if (!value) throw new TypeError("QR blocks require a value.");
    return Object.freeze({
      type,
      value,
      size: integer(block.size, 6, { min: 1, max: 16 }),
      errorCorrection: String(block.errorCorrection || "M").toUpperCase(),
      align: normalizeAlign(block.align, "center"),
    });
  }
  if (type === "barcode") {
    const value = String(block.value ?? block.text ?? "");
    if (!value) throw new TypeError("Barcode blocks require a value.");
    return Object.freeze({
      type,
      value,
      symbology: String(block.symbology || "CODE128").toUpperCase(),
      height: integer(block.height, 72, { min: 1, max: 255 }),
      moduleWidth: integer(block.moduleWidth, 2, { min: 2, max: 6 }),
      humanReadable: block.humanReadable !== false,
      align: normalizeAlign(block.align, "center"),
    });
  }
  if (type === "cut") {
    return Object.freeze({ type, mode: String(block.mode || "partial").toLowerCase() });
  }
  if (type === "drawer") {
    return Object.freeze({
      type,
      pin: integer(block.pin, 0, { min: 0, max: 1 }),
      onMs: integer(block.onMs, 100, { min: 0, max: 510 }),
      offMs: integer(block.offMs, 200, { min: 0, max: 510 }),
    });
  }
  return Object.freeze({ type });
}

export function resolvePaperProfile(paper = 80, overrides = {}) {
  const width = Number(typeof paper === "object" ? paper.widthMm : paper);
  const base = PAPER_PROFILES[width];
  if (!base) throw new RangeError("Supported receipt widths are 58mm and 80mm.");
  const source = typeof paper === "object" ? paper : {};
  return Object.freeze({
    widthMm: base.widthMm,
    charactersPerLine: integer(
      overrides.charactersPerLine ?? source.charactersPerLine,
      base.charactersPerLine,
      { min: 16, max: 80 },
    ),
  });
}

export function normalizeReceiptDocument(document = {}) {
  if (!document || typeof document !== "object") {
    throw new TypeError("Receipt document must be an object.");
  }
  const paper = resolvePaperProfile(document.paper || document.paperWidth || 80, document);
  const blocks = (Array.isArray(document.blocks) ? document.blocks : []).map((block) =>
    normalizeBlock(block, paper.charactersPerLine),
  );
  return Object.freeze({
    version: 1,
    type: "receipt",
    paper,
    blocks: Object.freeze(blocks),
    metadata: Object.freeze({ ...(document.metadata || {}) }),
  });
}

export const EDGE_RECEIPT_PAPER_PROFILES = PAPER_PROFILES;
