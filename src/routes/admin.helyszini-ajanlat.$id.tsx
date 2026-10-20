import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPage, Panel } from "@/components/admin/ui";
import { useKioskWhile } from "@/components/admin/kiosk-context";
import { Button } from "@/components/ui/button";
import { defaultSettings } from "@/demo/data";
import { useDemo } from "@/demo/store";
import { FieldQuoteEditor } from "@/components/admin/FieldQuoteEditor";
import { FieldQuoteCustomerView } from "@/components/admin/FieldQuoteCustomerView";
import { fieldQuoteApi, FieldQuoteApiError } from "@/lib/field-quote-client";
import { jobsApi, JobsApiError } from "@/lib/jobs-client";
import { computeFieldQuoteTotals } from "@/lib/field-quote-calc";
import {
  FIELD_QUOTE_STATUS_LABELS,
  type FieldQuote,
  type FieldQuoteStatus,
} from "@/demo/field-quote-types";
import { Copy, FileDown, HardHat, History, Smartphone, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/helyszini-ajanlat/$id")({
  head: () => ({
    meta: [{ title: "Helyszíni ajánlat — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: FieldQuoteDetailPage,
});

const SIGNABLE: FieldQuoteStatus[] = ["DRAFT", "READY", "WAITING_FOR_SIGNATURE"];

function FieldQuoteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { settings } = useDemo();
  const [quote, setQuote] = useState<FieldQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"edit" | "customer">("edit");
  const [busy, setBusy] = useState(false);
  const [publicLink, setPublicLink] = useState<{
    token: string;
    url: string;
    expiresAt: number;
  } | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  // True while the editor holds changes that aren't saved yet. Customer mode
  // and the public link both show the LAST SAVED state, so they must not be
  // reachable then — otherwise the customer would sign something different
  // from what the surveyor sees on screen.
  const [dirty, setDirty] = useState(false);

  // In customer mode the screen belongs to the customer: hide the admin menu.
  useKioskWhile(mode === "customer");

  // `silent` keeps the page (and the editor with its unsaved state) mounted;
  // only the very first load shows the loading placeholder.
  const reload = (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    return fieldQuoteApi
      .get(id)
      .then(setQuote)
      .catch(() => toast.error("Az ajánlat betöltése nem sikerült."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !quote) {
    return (
      <AdminPage title="Helyszíni ajánlat">
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      </AdminPage>
    );
  }

  const totals = computeFieldQuoteTotals(quote.items, quote.discountType, quote.discountValue);
  // The sample company data the site ships with. A signed quote records the
  // seller's name, address and tax number, so signing with the samples still in
  // place would produce a legal document naming a company that doesn't exist.
  const companyIsPlaceholder =
    settings.taxNumber === defaultSettings.taxNumber ||
    settings.address === defaultSettings.address ||
    settings.phone === defaultSettings.phone;

  const generatePublicLink = async () => {
    setBusy(true);
    try {
      const result = await fieldQuoteApi.publicLink(quote.id);
      setPublicLink(result);
      setMode("edit");
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${result.url}`);
        toast.success("A link létrejött és a vágólapra másolva.");
      } catch {
        toast.success("A link létrejött.");
      }
    } catch (e) {
      toast.error(e instanceof FieldQuoteApiError ? e.message : "A link létrehozása nem sikerült.");
    } finally {
      setBusy(false);
    }
  };

  const handleSign = async (signatureDataUrl: string, pdfBase64: string) => {
    setBusy(true);
    try {
      await fieldQuoteApi.sign(quote.id, signatureDataUrl, pdfBase64);
      toast.success("Az ajánlat aláírva.");
      setMode("edit");
      await reload({ silent: true });
    } catch (e) {
      toast.error(e instanceof FieldQuoteApiError ? e.message : "Az aláírás nem sikerült.");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async (reason?: string) => {
    setBusy(true);
    try {
      await fieldQuoteApi.decline(quote.id, reason);
      toast.success("Az elutasítás rögzítve.");
      setMode("edit");
      await reload({ silent: true });
    } catch (e) {
      toast.error(e instanceof FieldQuoteApiError ? e.message : "Nem sikerült rögzíteni.");
    } finally {
      setBusy(false);
    }
  };

  // One job per signed quote: creating is idempotent, so this simply opens it
  // when it already exists.
  const openJob = async () => {
    setBusy(true);
    try {
      const { job, created } = await jobsApi.create(quote.id);
      if (created) toast.success("A munka létrejött.");
      void navigate({ to: "/admin/munkak/$id", params: { id: job.id } });
    } catch (e) {
      toast.error(e instanceof JobsApiError ? e.message : "A munka indítása nem sikerült.");
      setBusy(false);
    }
  };

  const createNewVersion = async () => {
    setBusy(true);
    try {
      const created = await fieldQuoteApi.createNewVersion(quote.id);
      toast.success(`Új verzió létrehozva (v${created.version}).`);
      window.location.href = `/admin/helyszini-ajanlat/${created.id}`;
    } catch (e) {
      toast.error(
        e instanceof FieldQuoteApiError ? e.message : "Nem sikerült új verziót létrehozni.",
      );
      setBusy(false);
    }
  };

  if (mode === "customer") {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => {
            // A deliberate step: the customer is holding the device.
            if (
              window.confirm("Visszatér az admin nézetbe? Ezt csak Ön tegye meg, ne az ügyfél.")
            ) {
              setMode("edit");
            }
          }}
        >
          ← Kilépés az ügyfél módból
        </Button>
        <FieldQuoteCustomerView
          quote={quote}
          totals={totals}
          company={{
            name: settings.company,
            address: settings.address,
            phone: settings.phone,
            email: settings.email,
            taxNumber: settings.taxNumber,
          }}
          allowDecideLater
          busy={busy}
          onSign={(dataUrl, pdfBase64) => void handleSign(dataUrl, pdfBase64)}
          onDecline={(reason) => void handleDecline(reason)}
          onDecideLater={() => void generatePublicLink()}
        />
      </div>
    );
  }

  return (
    <AdminPage
      title={`${quote.customerName} — ${quote.number}`}
      intro={`${FIELD_QUOTE_STATUS_LABELS[quote.status]} · v${quote.version}`}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/helyszini-ajanlat">← Lista</Link>
        </Button>
      }
    >
      {publicLink ? (
        <Panel className="border-accent/40 bg-accent/5">
          <p className="text-sm font-semibold">Nyilvános link (később döntök)</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            {window.location.origin}
            {publicLink.url}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}${publicLink.url}`);
                  toast.success("Vágólapra másolva.");
                } catch {
                  /* clipboard unavailable — link is already shown on screen */
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Másolás
            </Button>
            <p className="self-center text-xs text-muted-foreground">
              Lejár: {new Date(publicLink.expiresAt).toLocaleDateString("hu-HU")}
            </p>
          </div>
        </Panel>
      ) : null}

      {quote.status === "SIGNED" ? (
        <Panel className="border-forest/40 bg-forest/5">
          <p className="font-semibold text-forest">Ez az ajánlat aláírva, a tartalma zárolva.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aláírva: {quote.signedAt ? new Date(quote.signedAt).toLocaleString("hu-HU") : "—"}
          </p>
          {quote.documentHash ? (
            <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
              Dokumentum hash (SHA-256): {quote.documentHash}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {quote.pdfKey ? (
              <Button asChild size="sm" variant="outline">
                <a
                  href={`/api/admin/field-quotes/media/${quote.pdfKey}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileDown className="h-3.5 w-3.5" /> Aláírt PDF letöltése
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="forest" disabled={busy} onClick={() => void openJob()}>
              <HardHat className="h-3.5 w-3.5" /> Munka indítása / megnyitása
            </Button>
            <Button
              size="sm"
              variant="copper"
              disabled={busy}
              onClick={() => void createNewVersion()}
            >
              <History className="h-3.5 w-3.5" /> Új verzió készítése (módosításhoz)
            </Button>
          </div>
        </Panel>
      ) : quote.status === "DECLINED" ? (
        <Panel className="border-destructive/40 bg-destructive/5">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <XCircle className="h-4 w-4" /> Az ügyfél elutasította az ajánlatot.
          </p>
          {quote.declineReason ? (
            <p className="mt-1 text-sm text-muted-foreground">Indoklás: {quote.declineReason}</p>
          ) : null}
          <Button
            size="sm"
            variant="copper"
            className="mt-3"
            disabled={busy}
            onClick={() => void createNewVersion()}
          >
            <History className="h-3.5 w-3.5" /> Új verzió készítése (újraajánlás)
          </Button>
        </Panel>
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-2 text-sm text-muted-foreground">Állapot:</p>
              {(["DRAFT", "READY", "WAITING_FOR_SIGNATURE", "CANCELLED"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={quote.status === s ? "copper" : "outline"}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await fieldQuoteApi.setStatus(quote.id, s);
                      await reload({ silent: true });
                    } catch (e) {
                      toast.error(
                        e instanceof FieldQuoteApiError ? e.message : "Nem sikerült módosítani.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {FIELD_QUOTE_STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          </Panel>

          {SIGNABLE.includes(quote.status) ? (
            <Panel
              title="Aláíratás"
              description="A legutóbb mentett állapotot mutatja — mentsen előbb, ha változtatott."
            >
              {companyIsPlaceholder ? (
                <p className="mb-2 rounded-[var(--radius-button)] border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  A cég adatai (adószám, cím vagy telefonszám) még a minta-értékek. Az aláírt
                  ajánlat PDF-jében és a dokumentum-pillanatképben ezek szerepelnének — töltse ki
                  őket a{" "}
                  <Link to="/admin/beallitasok" className="underline">
                    Beállítások
                  </Link>{" "}
                  oldalon, mielőtt aláírást kér.
                </p>
              ) : null}
              {dirty ? (
                <p className="mb-2 text-xs text-destructive">
                  Mentetlen módosítások vannak — mentse el az ajánlatot, mielőtt az ügyfél elé viszi
                  vagy linket készít.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="forest"
                  disabled={dirty}
                  onClick={() => setMode("customer")}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Ügyfél mód megnyitása (helyszíni aláírás)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || dirty}
                  onClick={() => void generatePublicLink()}
                >
                  Nyilvános link küldéshez (később dönt)
                </Button>
              </div>
            </Panel>
          ) : null}

          <FieldQuoteEditor
            key={editorKey}
            initial={quote}
            onDirtyChange={setDirty}
            onSaved={(saved) => {
              setQuote(saved);
              setDirty(false);
              setEditorKey((k) => k + 1);
            }}
          />
        </>
      )}
    </AdminPage>
  );
}
