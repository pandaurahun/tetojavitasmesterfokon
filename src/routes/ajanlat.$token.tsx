import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/demo/store";
import { FieldQuoteCustomerView } from "@/components/admin/FieldQuoteCustomerView";
import { fieldQuotePublicApi, FieldQuoteApiError } from "@/lib/field-quote-client";
import type { FieldQuoteTotals } from "@/demo/field-quote-types";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/ajanlat/$token")({
  head: () => ({ meta: [{ title: "Árajánlat" }, { name: "robots", content: "noindex" }] }),
  component: PublicFieldQuotePage,
});

type PublicQuote = Awaited<ReturnType<typeof fieldQuotePublicApi.get>>["quote"];

function PublicFieldQuotePage() {
  const { token } = Route.useParams();
  const { settings } = useDemo();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [totals, setTotals] = useState<FieldQuoteTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    fieldQuotePublicApi
      .get(token)
      .then((r) => {
        setQuote(r.quote);
        setTotals(r.totals);
      })
      .catch((e) =>
        setError(e instanceof FieldQuoteApiError ? e.message : "Az ajánlat nem érhető el."),
      );
  };

  useEffect(load, [token]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <p className="font-display text-lg font-semibold">
          {settings.company || "Tetőjavítás Mesterfokon"}
        </p>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        {error ? (
          <div className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : !quote || !totals ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Betöltés...</p>
        ) : (
          <FieldQuoteCustomerView
            quote={quote}
            totals={totals}
            company={{
              name: settings.company || "Tetőjavítás Mesterfokon",
              address: settings.address,
              phone: settings.phone,
              email: settings.email,
              taxNumber: settings.taxNumber,
            }}
            allowDecideLater={false}
            signedPdfUrl={
              quote.pdfKey ? `/api/field-quotes/public/${token}/media/${quote.pdfKey}` : undefined
            }
            busy={busy}
            onSign={async (signatureDataUrl, pdfBase64) => {
              setBusy(true);
              try {
                await fieldQuotePublicApi.sign(token, signatureDataUrl, pdfBase64);
                toast.success("Köszönjük, az ajánlatot aláírta.");
                load();
              } catch (e) {
                toast.error(
                  e instanceof FieldQuoteApiError ? e.message : "Az aláírás nem sikerült.",
                );
              } finally {
                setBusy(false);
              }
            }}
            onDecline={async (reason) => {
              setBusy(true);
              try {
                await fieldQuotePublicApi.decline(token, reason);
                toast.success("Az elutasítást rögzítettük.");
                load();
              } catch (e) {
                toast.error(
                  e instanceof FieldQuoteApiError ? e.message : "Nem sikerült rögzíteni.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
