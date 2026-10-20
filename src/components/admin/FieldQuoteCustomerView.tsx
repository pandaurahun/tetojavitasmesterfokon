import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad, type SignaturePadHandle } from "@/components/admin/SignaturePad";
import {
  DECLINE_REASONS,
  type FieldQuoteItem,
  type FieldQuoteStatus,
  type FieldQuoteTotals,
} from "@/demo/field-quote-types";
import { commonVatRate, formatPercent, formatQty, lineNet } from "@/lib/field-quote-calc";
import type { CompanyInfo } from "@/lib/field-quote-pdf";
import { CheckCircle2, Clock, FileDown, FileSignature, XCircle } from "lucide-react";

const huf = (value: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(value)) + " Ft";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export interface FieldQuoteCustomerViewData {
  number: string;
  version: number;
  status: FieldQuoteStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | undefined;
  customerAddress?: string | undefined;
  customerCity?: string | undefined;
  customerZip?: string | undefined;
  billingName?: string | undefined;
  billingAddress?: string | undefined;
  expectedStart?: string | undefined;
  expectedDuration?: string | undefined;
  items: FieldQuoteItem[];
  discountType?: "percent" | "fixed" | undefined;
  discountValue: number;
  paymentTerms?: string | undefined;
  validityDate?: string | undefined;
  customerNotes?: string | undefined;
  acceptanceText: string;
  signedAt?: string | undefined;
  declinedAt?: string | undefined;
  declineReason?: string | undefined;
}

export function FieldQuoteCustomerView({
  quote,
  totals,
  company,
  allowDecideLater,
  busy = false,
  onSign,
  onDecline,
  onDecideLater,
  signedPdfUrl,
}: {
  quote: FieldQuoteCustomerViewData;
  totals: FieldQuoteTotals;
  company: CompanyInfo;
  allowDecideLater: boolean;
  /** Where the customer can download their signed copy, once signed. */
  signedPdfUrl?: string | undefined;
  busy?: boolean;
  onSign: (signatureDataUrl: string, pdfBase64: string) => void;
  onDecline: (reason?: string) => void;
  onDecideLater?: () => void;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [accepted, setAccepted] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [signError, setSignError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  if (quote.status === "SIGNED") {
    return (
      <div className="rounded-[var(--radius-card)] border border-forest/30 bg-forest/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest" />
        <p className="mt-3 font-display text-lg font-semibold">Ez az ajánlat aláírva, elfogadva.</p>
        {quote.signedAt ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Aláírva: {new Date(quote.signedAt).toLocaleString("hu-HU")}
          </p>
        ) : null}
        {signedPdfUrl ? (
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={signedPdfUrl} target="_blank" rel="noreferrer">
              <FileDown className="h-4 w-4" /> Aláírt ajánlat letöltése (PDF)
            </a>
          </Button>
        ) : null}
      </div>
    );
  }
  if (quote.status === "CANCELLED" || quote.status === "EXPIRED") {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 text-center">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-display text-lg font-semibold">Ez az ajánlat már nem érvényes.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Kérjük, vegye fel velünk a kapcsolatot, ha új ajánlatot szeretne.
        </p>
      </div>
    );
  }
  if (quote.status === "DECLINED") {
    return (
      <div className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 p-6 text-center">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-3 font-display text-lg font-semibold">Ez az ajánlatot elutasították.</p>
        {quote.declineReason ? (
          <p className="mt-1 text-sm text-muted-foreground">Indoklás: {quote.declineReason}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-soft sm:p-6">
        <p className="label-eyebrow text-muted-foreground">{company.name}</p>
        <h2 className="mt-1 font-display text-xl font-semibold">
          Árajánlat {quote.number} <span className="text-muted-foreground">/ v{quote.version}</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {quote.customerName}
          {quote.customerCity
            ? ` — ${quote.customerZip ?? ""} ${quote.customerCity} ${quote.customerAddress ?? ""}`
            : ""}
        </p>
        {quote.billingName || quote.billingAddress ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Számlázási adatok:{" "}
            {[quote.billingName, quote.billingAddress].filter(Boolean).join(", ")}
          </p>
        ) : null}

        {/* Stacked rows instead of a <table> — a fixed-column table forces
            horizontal scroll on phone widths and hides the price column,
            which is exactly the data a customer most needs to see. */}
        <div className="mt-5 divide-y divide-border text-sm">
          <div className="hidden pb-2 text-xs font-semibold text-muted-foreground sm:flex sm:justify-between">
            <span>Tétel</span>
            <span>Nettó</span>
          </div>
          {quote.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{item.name}</p>
                {item.description ? (
                  <p className="text-xs break-words text-muted-foreground">{item.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {formatQty(item.qty)} {item.unit} × {huf(item.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 font-medium whitespace-nowrap">
                {huf(lineNet(item.qty, item.unitPrice))}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nettó összesen</span>
            <span>{huf(totals.net)}</span>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between text-forest">
              <span>
                Kedvezmény
                {quote.discountType === "percent" ? ` (${formatPercent(quote.discountValue)})` : ""}
              </span>
              <span>− {huf(totals.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Áfa
              {commonVatRate(quote.items) !== null
                ? ` (${formatPercent(commonVatRate(quote.items) ?? 0)})`
                : ""}
            </span>
            <span>{huf(totals.vat)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-display text-base font-semibold">
            <span>Bruttó végösszeg</span>
            <span>{huf(totals.gross)}</span>
          </div>
        </div>

        {quote.paymentTerms ? (
          <p className="mt-4 text-sm">
            <span className="font-semibold">Fizetési feltételek: </span>
            {quote.paymentTerms}
          </p>
        ) : null}
        {quote.validityDate ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Ajánlat érvényes: {new Date(quote.validityDate).toLocaleDateString("hu-HU")}
          </p>
        ) : null}
        {quote.customerNotes ? (
          <p className="mt-3 text-sm whitespace-pre-line">{quote.customerNotes}</p>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-soft sm:p-6">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{quote.acceptanceText}</span>
        </label>

        <p className="mt-4 text-xs text-muted-foreground">
          A rendszer helyszíni, képernyőn rögzített aláírást és dokumentum-elfogadást kezel, nem
          minősített elektronikus aláírást.
        </p>

        <div className="mt-3">
          <SignaturePad ref={padRef} />
        </div>
        {signError ? <p className="mt-2 text-sm text-destructive">{signError}</p> : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="forest"
            disabled={busy || preparing}
            onClick={async () => {
              if (!accepted) {
                setSignError("A nyilatkozat elfogadása kötelező az aláíráshoz.");
                return;
              }
              const dataUrl = padRef.current?.toPngDataUrl();
              if (!dataUrl) {
                setSignError("Kérjük, írjon alá az aláírásmezőben.");
                return;
              }
              setSignError(null);
              setPreparing(true);
              try {
                const pngMatch = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
                const base64Payload = pngMatch?.[1];
                const signaturePngBytes = base64Payload
                  ? Uint8Array.from(atob(base64Payload), (c) => c.charCodeAt(0))
                  : new Uint8Array();
                const signedAtText = new Date().toLocaleString("hu-HU", {
                  dateStyle: "long",
                  timeStyle: "short",
                });
                // Dynamic import keeps pdf-lib out of the SSR module graph —
                // statically importing it here pulled it into the server
                // bundle too (component is SSR'd for its initial markup)
                // and crashed the Worker at module-eval time, even though
                // this code only ever runs from a browser click handler.
                const { generateFieldQuotePdf } = await import("@/lib/field-quote-pdf");
                const pdfBytes = await generateFieldQuotePdf({
                  quote,
                  totals,
                  company,
                  signaturePngBytes,
                  signedAtText,
                });
                onSign(dataUrl, bytesToBase64(pdfBytes));
              } catch {
                setSignError("A dokumentum előkészítése nem sikerült. Próbálja újra.");
              } finally {
                setPreparing(false);
              }
            }}
          >
            <FileSignature className="h-4 w-4" />{" "}
            {preparing ? "Előkészítés..." : "Elfogadom és aláírom"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setDeclineOpen((v) => !v)}
          >
            <XCircle className="h-4 w-4" /> Most nem fogadom el
          </Button>
          {allowDecideLater ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={onDecideLater}>
              <Clock className="h-4 w-4" /> Később szeretnék dönteni
            </Button>
          ) : null}
        </div>

        {declineOpen ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Mi az elutasítás oka? (opcionális)</p>
            <div className="flex flex-wrap gap-2">
              {DECLINE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setDeclineReason(reason)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    declineReason === reason
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Egyéb megjegyzés..."
              rows={2}
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => onDecline(declineReason || undefined)}
            >
              Elutasítás megerősítése
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
