import { normalizePrintBytes } from "./printing_contract";
import { normalizeReceiptDocument } from "./printing_document";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function concatBytes(parts) {
  const arrays = parts.map((part) => normalizePrintBytes(part));
  const total = arrays.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of arrays) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function byteClamp(value) {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

function alignCode(align) {
  return align === "center" ? 1 : align === "right" ? 2 : 0;
}

function textSize(width = 1, height = 1) {
  const w = Math.max(1, Math.min(8, Number(width) || 1)) - 1;
  const h = Math.max(1, Math.min(8, Number(height) || 1)) - 1;
  return (w << 4) | h;
}

function fitCell(text, width, align = "left") {
  const value = String(text ?? "");
  if (value.length >= width) return value.slice(0, width);
  const padding = " ".repeat(width - value.length);
  if (align === "right") return padding + value;
  if (align === "center") {
    const left = Math.floor(padding.length / 2);
    return padding.slice(0, left) + value + padding.slice(left);
  }
  return value + padding;
}

function wrapText(text, width) {
  const value = String(text ?? "");
  if (!width || value.length <= width) return [value];

  const lines = [];
  for (const paragraph of value.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let remaining = paragraph;
    while (remaining.length > width) {
      let splitAt = remaining.lastIndexOf(" ", width);
      if (splitAt <= 0) splitAt = width;
      lines.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

function defaultEncodeText(value) {
  return new TextEncoder().encode(String(value ?? ""));
}

export function escposInitialize() {
  return Uint8Array.from([ESC, 0x40]);
}

export function escposAlign(align = "left") {
  return Uint8Array.from([ESC, 0x61, alignCode(align)]);
}

export function escposBold(enabled = false) {
  return Uint8Array.from([ESC, 0x45, enabled ? 1 : 0]);
}

export function escposTextSize(width = 1, height = 1) {
  return Uint8Array.from([GS, 0x21, textSize(width, height)]);
}

export function escposFeed(lines = 1) {
  return Uint8Array.from([ESC, 0x64, byteClamp(lines)]);
}

export function escposCut(mode = "partial") {
  return Uint8Array.from([GS, 0x56, mode === "full" ? 0 : 1]);
}

export function escposDrawer({ pin = 0, onMs = 100, offMs = 200 } = {}) {
  const m = Number(pin) === 1 ? 1 : 0;
  return Uint8Array.from([
    ESC,
    0x70,
    m,
    byteClamp(Math.round(Number(onMs || 0) / 2)),
    byteClamp(Math.round(Number(offMs || 0) / 2)),
  ]);
}

export function escposQr(value, { size = 6, errorCorrection = "M" } = {}, encodeText = defaultEncodeText) {
  const data = encodeText(String(value));
  const model = Uint8Array.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
  const moduleSize = Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, byteClamp(size)]);
  const eccMap = { L: 48, M: 49, Q: 50, H: 51 };
  const ecc = Uint8Array.from([
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x45,
    eccMap[String(errorCorrection || "M").toUpperCase()] ?? 49,
  ]);
  const storeLength = data.byteLength + 3;
  const store = concatBytes([
    Uint8Array.from([
      GS,
      0x28,
      0x6b,
      storeLength & 0xff,
      (storeLength >> 8) & 0xff,
      0x31,
      0x50,
      0x30,
    ]),
    data,
  ]);
  const print = Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
  return concatBytes([model, moduleSize, ecc, store, print]);
}

export function escposCode128(
  value,
  { height = 72, moduleWidth = 2, humanReadable = true } = {},
  encodeText = defaultEncodeText,
) {
  const raw = String(value ?? "");
  if (!raw) throw new TypeError("CODE128 barcode value is required.");
  const payload = encodeText(raw.startsWith("{") ? raw : `{B${raw}`);
  if (payload.byteLength > 255) throw new RangeError("CODE128 barcode payload is too long.");

  return concatBytes([
    Uint8Array.from([GS, 0x68, byteClamp(height)]),
    Uint8Array.from([GS, 0x77, byteClamp(moduleWidth)]),
    Uint8Array.from([GS, 0x48, humanReadable ? 2 : 0]),
    Uint8Array.from([GS, 0x6b, 73, payload.byteLength]),
    payload,
  ]);
}

export function escposRasterImage({ width, height, data }) {
  const packed = normalizePrintBytes(data);
  const bytesPerRow = Math.ceil(Number(width) / 8);
  const expected = bytesPerRow * Number(height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new TypeError("Raster image width and height must be positive integers.");
  }
  if (packed.byteLength !== expected) {
    throw new RangeError(`Raster image requires exactly ${expected} packed monochrome bytes.`);
  }
  return concatBytes([
    Uint8Array.from([
      GS,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
    ]),
    packed,
  ]);
}

function encodeTextLine(text, encodeText) {
  return concatBytes([encodeText(text), Uint8Array.from([LF])]);
}

function encodeTextBlock(block, charactersPerLine, encodeText) {
  const contentWidth = Math.max(1, Math.floor(charactersPerLine / Math.max(1, block.width)));
  const lines = block.wrap ? wrapText(block.text, contentWidth) : [block.text];
  return concatBytes([
    escposAlign(block.align),
    escposBold(block.bold),
    escposTextSize(block.width, block.height),
    ...lines.map((line) => encodeTextLine(line, encodeText)),
    escposTextSize(1, 1),
    escposBold(false),
    escposAlign("left"),
  ]);
}

function encodeRowBlock(block, encodeText) {
  const gap = " ".repeat(block.gap || 0);
  const line = block.columns
    .map((column) => fitCell(column.text, column.width, column.align))
    .join(gap);
  return concatBytes([
    escposBold(block.bold),
    encodeTextLine(line, encodeText),
    escposBold(false),
  ]);
}

export function encodeEscPosDocument(document, { encodeText = defaultEncodeText } = {}) {
  if (typeof encodeText !== "function") throw new TypeError("encodeText must be a function.");
  const receipt = normalizeReceiptDocument(document);
  const parts = [escposInitialize()];

  for (const block of receipt.blocks) {
    if (block.type === "text") {
      parts.push(encodeTextBlock(block, receipt.paper.charactersPerLine, encodeText));
    } else if (block.type === "rule") {
      parts.push(encodeTextLine(block.char.repeat(block.length), encodeText));
    } else if (block.type === "row") {
      parts.push(encodeRowBlock(block, encodeText));
    } else if (block.type === "feed") {
      parts.push(escposFeed(block.lines));
    } else if (block.type === "qr") {
      parts.push(escposAlign(block.align), escposQr(block.value, block, encodeText), escposAlign("left"));
    } else if (block.type === "barcode") {
      if (block.symbology !== "CODE128") {
        throw new RangeError(`Unsupported ESC/POS barcode symbology: ${block.symbology}`);
      }
      parts.push(
        escposAlign(block.align),
        escposCode128(block.value, block, encodeText),
        Uint8Array.from([LF]),
        escposAlign("left"),
      );
    } else if (block.type === "image") {
      parts.push(
        escposAlign(block.align),
        escposRasterImage(block),
        Uint8Array.from([LF]),
        escposAlign("left"),
      );
    } else if (block.type === "cut") {
      parts.push(escposCut(block.mode));
    } else if (block.type === "drawer") {
      parts.push(escposDrawer(block));
    }
  }

  return concatBytes(parts);
}

export const edgeEscPos = Object.freeze({
  encodeDocument: encodeEscPosDocument,
  initialize: escposInitialize,
  align: escposAlign,
  bold: escposBold,
  textSize: escposTextSize,
  feed: escposFeed,
  cut: escposCut,
  drawer: escposDrawer,
  qr: escposQr,
  code128: escposCode128,
  rasterImage: escposRasterImage,
});
