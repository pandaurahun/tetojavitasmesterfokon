import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import dejaVuSansUrl from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import dejaVuSansBoldUrl from "dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url";
import type { FieldQuote, FieldQuoteTotals } from "@/demo/field-quote-types";
import { commonVatRate, formatPercent, formatQty, lineNet } from "@/lib/field-quote-calc";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const RIGHT = A4[0] - MARGIN;
const FOOTER_RESERVE = 40;
const GREY: [number, number, number] = [0.4, 0.42, 0.46];
const LIGHT_GREY: [number, number, number] = [0.5, 0.52, 0.56];

const formatHuf = (value: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(value)) + " Ft";

// "2026-12-31" is a calendar date, not an instant — formatting it through the
// local timezone could show the previous day.
function formatDateHu(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("hu-HU", { timeZone: "UTC" });
}

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
}

// Only the fields the rendering actually reads — structurally satisfied by
// both the full admin FieldQuote and the customer-safe redacted projection
// served on the public decide-later link, so one PDF renderer covers both.
export type FieldQuotePdfSource = Pick<
  FieldQuote,
  | "number"
  | "version"
  | "createdAt"
  | "customerName"
  | "customerAddress"
  | "customerCity"
  | "customerZip"
  | "customerPhone"
  | "customerEmail"
  | "billingName"
  | "billingAddress"
  | "expectedStart"
  | "expectedDuration"
  | "items"
  | "discountType"
  | "discountValue"
  | "paymentTerms"
  | "validityDate"
  | "customerNotes"
  | "acceptanceText"
>;

export interface FieldQuotePdfInput {
  quote: FieldQuotePdfSource;
  totals: FieldQuoteTotals;
  company: CompanyInfo;
  signaturePngBytes: Uint8Array;
  signedAtText: string;
}

let cachedFonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

// Fetched once per page session and reused — these are the full DejaVu Sans
// TTFs (~700KB each, chosen for its unusually complete Latin Extended-A
// coverage, including the Hungarian double-acute ő/ű that pdf-lib's built-in
// StandardFonts cannot encode at all). pdf-lib subsets on embed, so only the
// glyphs actually used end up in the generated PDF — the full files are just
// the one-time, browser-cached source to subset from.
async function loadFontBytes(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (cachedFonts) return cachedFonts;
  const [regular, bold] = await Promise.all([
    fetch(dejaVuSansUrl).then((r) => r.arrayBuffer()),
    fetch(dejaVuSansBoldUrl).then((r) => r.arrayBuffer()),
  ]);
  cachedFonts = { regular, bold };
  return cachedFonts;
}

// Control characters (tabs, form feeds, stray bytes pasted from other apps)
// have no glyph and can break text layout — they become plain spaces. Line
// breaks are handled before this, by wrapText.
function clean(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? " " : char;
  }
  return out;
}

// Greedy word wrap by measured width. A single word wider than the line (a
// long URL, a pasted token) is split by character so nothing runs off the page.
function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawParagraph of value.split(/\r?\n/)) {
    const paragraph = clean(rawParagraph);
    let line = "";
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const char of word) {
        if (chunk && font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

interface TextOptions {
  x?: number;
  size?: number;
  bold?: boolean;
  color?: [number, number, number];
}

class Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;

  constructor(doc: PDFDocument, page: PDFPage, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.page = page;
    this.y = page.getHeight() - MARGIN;
    this.font = font;
    this.bold = bold;
  }

  /** Starts a new page when `h` doesn't fit above the footer; true if it did. */
  ensureSpace(h: number): boolean {
    if (this.y - h < MARGIN + FOOTER_RESERVE - 10) {
      this.page = this.doc.addPage(A4);
      this.y = this.page.getHeight() - MARGIN;
      return true;
    }
    return false;
  }

  private fontFor(opts: TextOptions): PDFFont {
    return opts.bold ? this.bold : this.font;
  }

  private color(opts: TextOptions) {
    return opts.color ? rgb(...opts.color) : rgb(0.07, 0.09, 0.13);
  }

  text(value: string, opts: TextOptions = {}) {
    this.page.drawText(clean(value), {
      x: opts.x ?? MARGIN,
      y: this.y,
      size: opts.size ?? 10,
      font: this.fontFor(opts),
      color: this.color(opts),
    });
  }

  /** Right-aligned so that the text ends exactly at `rightX`. */
  textRight(value: string, rightX: number, opts: TextOptions = {}) {
    const size = opts.size ?? 10;
    const width = this.fontFor(opts).widthOfTextAtSize(clean(value), size);
    this.text(value, { ...opts, x: rightX - width });
  }

  /** Word-wrapped block from the current line down; moves the cursor below it. */
  paragraph(value: string, opts: TextOptions & { width?: number; lineHeight?: number } = {}) {
    const size = opts.size ?? 10;
    const x = opts.x ?? MARGIN;
    const lineHeight = opts.lineHeight ?? size * 1.4;
    const lines = wrapText(value, this.fontFor(opts), size, opts.width ?? RIGHT - x);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.text(line, { ...opts, x, size });
      this.y -= lineHeight;
    }
  }

  lineBreak(h = 14) {
    this.y -= h;
    this.ensureSpace(0);
  }

  rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: RIGHT, y: this.y },
      thickness: 0.6,
      color: rgb(0.78, 0.76, 0.71),
    });
  }
}

export async function generateFieldQuotePdf(input: FieldQuotePdfInput): Promise<Uint8Array> {
  const { quote, totals, company, signaturePngBytes, signedAtText } = input;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes = await loadFontBytes();
  const font = await doc.embedFont(fontBytes.regular, { subset: true });
  const bold = await doc.embedFont(fontBytes.bold, { subset: true });
  const c = new Cursor(doc, doc.addPage(A4), font, bold);

  c.text(company.name, { bold: true, size: 16 });
  c.lineBreak(18);
  const companyLine = [company.address, company.taxNumber && `Adószám: ${company.taxNumber}`]
    .filter(Boolean)
    .join("  •  ");
  if (companyLine) c.paragraph(companyLine, { size: 9, color: GREY });
  const contactLine = [company.phone, company.email].filter(Boolean).join("  •  ");
  if (contactLine) c.paragraph(contactLine, { size: 9, color: GREY });
  c.lineBreak(14);

  c.text("HELYSZÍNI AJÁNLAT", { bold: true, size: 14 });
  c.textRight(`${quote.number} / v${quote.version}`, RIGHT, { size: 10 });
  c.lineBreak(16);
  c.textRight(`Kelt: ${formatDateHu(quote.createdAt)}`, RIGHT, { size: 9, color: GREY });
  c.lineBreak(20);
  c.rule();
  c.lineBreak(20);

  c.text("Ügyfél", { bold: true, size: 10 });
  c.lineBreak(14);
  c.paragraph(quote.customerName, { size: 10 });
  const addressLine = [quote.customerZip, quote.customerCity, quote.customerAddress]
    .filter(Boolean)
    .join(" ");
  if (addressLine) c.paragraph(addressLine, { size: 10 });
  const billing = [quote.billingName, quote.billingAddress].filter(Boolean).join(", ");
  if (billing) c.paragraph(`Számlázási adatok: ${billing}`, { size: 9, color: GREY });
  const contact = [quote.customerPhone, quote.customerEmail].filter(Boolean).join("  •  ");
  if (contact) c.paragraph(contact, { size: 10 });
  c.lineBreak(10);

  if (quote.expectedStart || quote.expectedDuration) {
    c.paragraph(
      `Várható kezdés: ${quote.expectedStart || "egyeztetés szerint"}${quote.expectedDuration ? `  •  Időtartam: ${quote.expectedDuration}` : ""}`,
      { size: 9, color: GREY },
    );
    c.lineBreak(8);
  }

  // Items table
  const cols = { name: MARGIN, qty: MARGIN + 262, price: MARGIN + 350 };
  const nameWidth = cols.qty - cols.name - 10;
  const priceRight = RIGHT - 78;
  const tableHeader = () => {
    c.rule();
    c.lineBreak(15);
    c.text("Tétel", { bold: true, size: 9, x: cols.name });
    c.text("Menny.", { bold: true, size: 9, x: cols.qty });
    c.textRight("Egységár", priceRight, { bold: true, size: 9 });
    c.textRight("Nettó", RIGHT, { bold: true, size: 9 });
    c.lineBreak(8);
    c.rule();
    c.lineBreak(15);
  };
  c.ensureSpace(60);
  tableHeader();

  for (const item of quote.items) {
    const nameLines = wrapText(item.name, font, 9.5, nameWidth);
    const descLines = item.description ? wrapText(item.description, font, 8, nameWidth) : [];
    const rowHeight = nameLines.length * 13 + descLines.length * 11 + 3;
    // A row is never split across pages; the column header repeats on the new one.
    if (c.ensureSpace(rowHeight)) tableHeader();
    const rowTop = c.y;
    c.text(`${formatQty(item.qty)} ${item.unit}`, { x: cols.qty, size: 9.5 });
    c.textRight(formatHuf(item.unitPrice), priceRight, { size: 9.5 });
    c.textRight(formatHuf(lineNet(item.qty, item.unitPrice)), RIGHT, { size: 9.5 });
    for (const line of nameLines) {
      c.text(line, { x: cols.name, size: 9.5 });
      c.y -= 13;
    }
    for (const line of descLines) {
      c.text(line, { x: cols.name, size: 8, color: LIGHT_GREY });
      c.y -= 11;
    }
    c.y = Math.min(c.y, rowTop - 13) - 3;
  }
  c.lineBreak(2);
  c.rule();
  c.lineBreak(18);

  const totalRow = (label: string, value: string, emphasize = false) => {
    c.ensureSpace(20);
    c.text(label, { x: RIGHT - 220, size: emphasize ? 11 : 9.5, bold: emphasize });
    c.textRight(value, RIGHT, { size: emphasize ? 11 : 9.5, bold: emphasize });
    c.lineBreak(emphasize ? 16 : 13);
  };
  totalRow("Nettó összesen", formatHuf(totals.net));
  if (totals.discount > 0) {
    const discountLabel =
      quote.discountType === "percent"
        ? `Kedvezmény (${formatPercent(quote.discountValue)})`
        : "Kedvezmény";
    totalRow(discountLabel, `- ${formatHuf(totals.discount)}`);
  }
  const vatRate = commonVatRate(quote.items);
  totalRow(vatRate === null ? "Áfa" : `Áfa (${formatPercent(vatRate)})`, formatHuf(totals.vat));
  totalRow("Bruttó végösszeg", formatHuf(totals.gross), true);
  c.lineBreak(12);

  if (quote.paymentTerms) {
    c.ensureSpace(40);
    c.text("Fizetési feltételek:", { bold: true, size: 9 });
    c.lineBreak(13);
    c.paragraph(quote.paymentTerms, { size: 9 });
    c.lineBreak(10);
  }
  if (quote.validityDate) {
    c.ensureSpace(20);
    c.text(`Ajánlat érvényes: ${formatDateHu(quote.validityDate)}`, { size: 9 });
    c.lineBreak(16);
  }
  if (quote.customerNotes) {
    c.ensureSpace(40);
    c.text("Megjegyzés:", { bold: true, size: 9 });
    c.lineBreak(13);
    c.paragraph(quote.customerNotes, { size: 9 });
    c.lineBreak(10);
  }

  // The acceptance statement, signature and signing time stay together.
  c.ensureSpace(190);
  c.lineBreak(6);
  c.rule();
  c.lineBreak(20);
  c.text("Elfogadó nyilatkozat:", { bold: true, size: 9 });
  c.lineBreak(13);
  c.paragraph(quote.acceptanceText, { size: 9 });
  c.lineBreak(14);

  const sigImage = await doc.embedPng(signaturePngBytes);
  const sigDims = sigImage.scaleToFit(180, 70);
  c.ensureSpace(sigDims.height + 40);
  // Always the CURRENT page — a long quote may have flowed onto page 2+.
  c.page.drawImage(sigImage, {
    x: MARGIN,
    y: c.y - sigDims.height,
    width: sigDims.width,
    height: sigDims.height,
  });
  c.lineBreak(sigDims.height + 6);
  c.rule();
  c.lineBreak(14);
  c.text(`Aláírva: ${signedAtText}`, { size: 8, color: GREY });

  // Footer on every page: which document, which page of how many.
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const label = `${quote.number} / v${quote.version}`;
    page.drawText(label, { x: MARGIN, y: 28, size: 8, font, color: rgb(...GREY) });
    const pageLabel = `${index + 1}. oldal / ${pages.length}`;
    page.drawText(pageLabel, {
      x: RIGHT - font.widthOfTextAtSize(pageLabel, 8),
      y: 28,
      size: 8,
      font,
      color: rgb(...GREY),
    });
  });

  return doc.save();
}
