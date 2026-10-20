import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudUpload,
  FileText,
  Home,
  Image as ImageIcon,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Container } from "@/components/site/Primitives";
import { Mark } from "@/components/site/Header";
import { useCmsSection, useDemo, newId, nowStamp } from "@/demo/store";
import { urgencyLabels } from "@/demo/data";
import type { CustomField, DemoFile, Lead, Urgency } from "@/demo/types";
import { demoUiEnabled } from "@/lib/features";
import { trackQuoteRequestSubmit } from "@/lib/analytics";
import { clearSubmissionId, submissionId } from "@/lib/submission-id";

export const Route = createFileRoute("/ajanlatkeres")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { szolgaltatas?: string | undefined; lepes?: number | undefined } => ({
    szolgaltatas: typeof search["szolgaltatas"] === "string" ? search["szolgaltatas"] : undefined,
    lepes: Number(search["lepes"]) > 0 ? Number(search["lepes"]) : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Ajánlatkérés — TetőVonal tetőfedés és bádogozás" },
      {
        name: "description",
        content:
          "Töltsd ki a részletes ajánlatkérőt: szolgáltatás, épület, tetőadatok, fényképek. Felkészülten hívunk vissza és tételes ajánlatot készítünk.",
      },
      { property: "og:title", content: "Részletes ajánlatkérés — TetőVonal" },
      {
        property: "og:description",
        content: "Nyolc lépéses ajánlatkérő fényképfeltöltéssel és azonnali visszaigazolással.",
      },
    ],
  }),
  component: QuoteWizard,
});

const WIZ_KEY = "tetovonal-wizard-v1";

const buildingTypes = [
  "Családi ház",
  "Társasház",
  "Nyaraló",
  "Melléképület",
  "Ipari vagy mezőgazdasági épület",
  "Középület",
];
const roofShapes = ["Nyeregtető", "Kontytető", "Féltető", "Összetett", "Lapostető", "Nem tudom"];
const coverings = [
  "Betoncserép",
  "Kerámia cserép",
  "Hódfarkú cserép",
  "Palafedés",
  "Trapézlemez",
  "Zsindely",
  "Bitumenes lemez",
  "Nincs még fedés",
  "Nem tudom",
];
const levelOptions = ["Földszintes", "Földszint + tetőtér", "Két szint", "Kettőnél több szint"];
const accessOptions = [
  "Udvarról jól megközelíthető",
  "Szűk oldalkert",
  "Csak utcafrontról",
  "Nehezen megközelíthető",
];
const contactPrefs = ["Telefon", "E-mail", "SMS vagy üzenet"];
const callWindows = ["Délelőtt", "Délután", "Munkaidő után", "Bármikor"];

const urgencyOptions: { key: Urgency; note: string }[] = [
  { key: "azonnali", note: "Aktív beázás vagy viharkár, azonnali beavatkozás kell." },
  { key: "napokon-belul", note: "Néhány napon belül szeretnénk megoldást." },
  { key: "honapon-belul", note: "Egy hónapon belüli kivitelezésben gondolkodunk." },
  { key: "tervezett", note: "Tervezett felújítás, az időpont rugalmas." },
  { key: "tajekozodas", note: "Egyelőre árakról és lehetőségekről tájékozódom." },
];

interface WizardForm {
  service: string;
  buildingType: string;
  zip: string;
  city: string;
  street: string;
  area: string;
  shape: string;
  covering: string;
  levels: string;
  age: string;
  access: string;
  roofDescription: string;
  urgency: Urgency;
  files: DemoFile[];
  name: string;
  phone: string;
  email: string;
  preferredContact: string;
  callWindow: string;
  message: string;
  consent: boolean;
  extra: Record<string, string>;
}

const emptyForm: WizardForm = {
  service: "",
  buildingType: "",
  zip: "",
  city: "",
  street: "",
  area: "",
  shape: "",
  covering: "",
  levels: "",
  age: "",
  access: "",
  roofDescription: "",
  urgency: "honapon-belul",
  files: [],
  name: "",
  phone: "",
  email: "",
  preferredContact: "Telefon",
  callWindow: "Délelőtt",
  message: "",
  consent: false,
  extra: {},
};

const stepTitles = [
  "Milyen munkára van szükség?",
  "Milyen épületről van szó?",
  "Hol található az ingatlan?",
  "A tető főbb adatai",
  "Mennyire sürgős?",
  "Képek és dokumentumok",
  "Kapcsolattartási adatok",
  "Ellenőrzés és beküldés",
];

const stepShort = [
  "Szolgáltatás",
  "Épület",
  "Helyszín",
  "Tetőadatok",
  "Sürgősség",
  "Képek",
  "Kapcsolat",
  "Ellenőrzés",
];

function QuoteWizard() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { services, fields, addLead, settings } = useDemo();
  const { section, value } = useCmsSection("quote.wizard");
  const editableStepTitles = stepTitles.map((title, index) =>
    value(`step.${index + 1}.title`, title),
  );
  const editableStepShort = stepShort.map((title, index) =>
    value(`step.${index + 1}.short`, title),
  );
  const activeServices = useMemo(
    () => services.filter((s) => s.active).sort((a, b) => a.order - b.order),
    [services],
  );

  const [form, setForm] = useState<WizardForm>({
    ...emptyForm,
    service: search.szolgaltatas ?? "",
  });
  const [step, setStep] = useState(Math.min(Math.max(search.lepes ?? 1, 1), 8));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState<Lead | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // React state updates are async, so two clicks in the same tick would both
  // see `submitting === false`; the ref closes that gap.
  const submittingRef = useRef(false);
  // Photos upload in the background while the visitor keeps going. Their
  // state lives here (not in the file step) so leaving the step doesn't lose
  // it, and so the final submit can wait for photos still on their way.
  const [uploadState, setUploadState] = useState<UploadStates>({});
  const pendingFiles = useRef(new Map<string, File>());
  const updateFiles = useCallback(
    (updater: (prev: DemoFile[]) => DemoFile[]) =>
      setForm((prev) => ({ ...prev, files: updater(prev.files) })),
    [],
  );
  const uploadingCount = Object.values(uploadState).filter((s) => s === "uploading").length;
  const failedCount = Object.values(uploadState).filter((s) => s === "failed").length;

  // Preview object URLs are released when the wizard goes away.
  const formRef = useRef<WizardForm | null>(null);
  formRef.current = form;
  useEffect(
    () => () => {
      for (const f of formRef.current?.files ?? []) {
        if (f.dataUrl?.startsWith("blob:")) URL.revokeObjectURL(f.dataUrl);
      }
    },
    [],
  );

  // Restore saved draft (client only, no hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WIZ_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardForm> & { step?: number };
        setForm((prev) => ({
          ...prev,
          ...parsed,
          files: persistableFiles(Array.isArray(parsed.files) ? parsed.files : []),
          consent: false,
        }));
        if (!search.lepes && parsed.step) setStep(Math.min(Math.max(parsed.step, 1), 8));
      }
    } catch {
      /* a demó üres űrlappal indul */
    }
    if (search.szolgaltatas) {
      setForm((prev) => ({ ...prev, service: search.szolgaltatas as string }));
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      // Without the photo previews: a few of them would overflow localStorage's
      // quota and then NOTHING (not even the typed answers) would be kept.
      window.localStorage.setItem(
        WIZ_KEY,
        JSON.stringify({ ...form, files: persistableFiles(form.files), step }),
      );
    } catch {
      /* tárolási korlát esetén memóriában marad */
    }
  }, [form, step, loaded]);

  const serviceObj = activeServices.find((s) => s.title === form.service);
  const serviceFields: CustomField[] = fields
    .filter((f) => f.publicVisible && serviceObj && f.serviceId === serviceObj.id)
    .sort((a, b) => a.order - b.order);

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1 && !form.service) e["service"] = "Válaszd ki, milyen munkára van szükség.";
    if (s === 2 && !form.buildingType) e["buildingType"] = "Válaszd ki az épület típusát.";
    if (s === 3) {
      if (!form.city.trim()) e["city"] = "A település megadása kötelező.";
      if (form.zip && !/^\d{4}$/.test(form.zip.trim()))
        e["zip"] = "Az irányítószám négy számjegyből áll.";
    }
    if (s === 4) {
      if (!form.shape) e["shape"] = "Válaszd ki a tető formáját.";
      if (form.area && !/^\d+([.,]\d+)?$/.test(form.area.trim()))
        e["area"] = "A tetőfelületet számként add meg (m²).";
      serviceFields.forEach((f) => {
        if (f.required && !form.extra[f.key]) e[`extra-${f.key}`] = "Ez a mező kötelező.";
      });
    }
    if (s === 7) {
      if (!form.name.trim()) e["name"] = "Add meg a nevedet.";
      if (!/^[+\d][\d\s\-/()]{6,}$/.test(form.phone.trim()))
        e["phone"] = "Adj meg egy érvényes telefonszámot.";
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
        e["email"] = "Az e-mail cím formátuma nem megfelelő.";
    }
    if (s === 8 && !form.consent) e["consent"] = "Az adatkezelés elfogadása szükséges.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goTo = (s: number) => {
    setStep(s);
    setErrors({});
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const next = () => {
    if (!validate(step)) return;
    goTo(Math.min(step + 1, 8));
  };
  const back = () => goTo(Math.max(step - 1, 1));

  const submit = async () => {
    if (submittingRef.current || uploadingCount > 0) return;
    if (!validate(8)) return;
    // The same id for every retry of THIS request (refresh, double click, a
    // response lost on a bad connection) so the server stores it once; it
    // changes only when the content does, and is cleared on success.
    const leadId = submissionId("wizard", [
      form.name.trim(),
      form.phone.trim(),
      form.email.trim(),
      form.city.trim(),
      form.zip.trim(),
      form.street.trim(),
      form.service,
      form.buildingType,
      form.urgency,
      form.message.trim(),
      form.area,
      form.shape,
      form.files.length,
    ]);
    const lead: Lead = {
      id: leadId,
      createdAt: new Date().toISOString(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      zip: form.zip.trim() || undefined,
      street: form.street.trim() || undefined,
      service: form.service,
      buildingType: form.buildingType,
      urgency: form.urgency,
      status: "uj",
      source: "reszletes-ajanlatkero",
      preferredContact: form.preferredContact,
      callWindow: form.callWindow,
      message: form.message.trim() || undefined,
      roof: {
        area: form.area ? `${form.area} m²` : undefined,
        shape: form.shape || undefined,
        covering: form.covering || undefined,
        levels: form.levels || undefined,
        age: form.age || undefined,
        access: form.access || undefined,
        description: form.roofDescription || undefined,
      },
      files: form.files,
      owner: "Kovács Tamás",
      nextTask:
        form.urgency === "azonnali" ? "Sürgős visszahívás" : `Visszahívás: ${form.callWindow}`,
      notes: [],
      timeline: [
        {
          id: newId("tl"),
          date: nowStamp(),
          title: "Ajánlatkérés beérkezett",
          detail: "Részletes ajánlatkérő a weboldalról",
        },
      ],
      extra: Object.keys(form.extra).length ? form.extra : undefined,
    };
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { duplicate } = await addLead(lead);
      // A recognised repeat was already counted the first time.
      if (!duplicate) trackQuoteRequestSubmit();
      clearSubmissionId("wizard");
      try {
        window.localStorage.removeItem(WIZ_KEY);
      } catch {
        /* nincs teendő */
      }
      setSubmitted(lead);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError(
        "Az ajánlatkérés mentése nem sikerült. Kérjük, próbáld újra, vagy keress minket telefonon.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <Confirmation lead={submitted} phone={settings.phone} />;
  }

  const progress = Math.round(((step - 1) / 7) * 100);

  return (
    <div
      className={`min-h-screen bg-background pb-28 sm:pb-16 ${
        section?.visible === false ? "hidden" : ""
      }`}
    >
      <div ref={topRef} />
      <header className="sticky top-0 z-50 border-b border-border bg-[color-mix(in_oklab,var(--background)_90%,transparent)] backdrop-blur-xl">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <Mark />
            <span className="truncate font-display text-lg font-semibold">
              {value("header", "Ajánlatkérés")}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {step}. lépés / 8 — {value("autosave", "automatikusan mentve")}
            </span>
            <button
              onClick={() => navigate({ to: "/" })}
              aria-label="Kilépés az ajánlatkérőből"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </Container>
        <div className="h-1 w-full bg-muted">
          <motion.div
            className="h-full bg-accent"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </header>

      <Container className="grid gap-8 pt-8 lg:grid-cols-[240px_1fr] lg:gap-12 lg:pt-12">
        <nav aria-label="Folyamatjelző" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <ol className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {editableStepShort.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} className="shrink-0">
                  <button
                    onClick={() => (n < step ? goTo(n) : undefined)}
                    disabled={n > step}
                    className={`flex w-full items-center gap-2.5 rounded-[var(--radius-button)] px-3 py-2 text-left text-sm transition-colors ${
                      current
                        ? "bg-ink text-ink-foreground"
                        : done
                          ? "text-foreground hover:bg-muted"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        done
                          ? "bg-forest text-forest-foreground"
                          : current
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : n}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              <p className="label-eyebrow text-accent">{step}. lépés</p>
              <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
                {editableStepTitles[step - 1]}
              </h1>

              <div className="mt-7 space-y-6">
                {step === 1 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeServices.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => set("service", s.title)}
                        className={`rounded-[var(--radius-card)] border p-4 text-left transition-all ${
                          form.service === s.title
                            ? "border-accent bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] shadow-soft"
                            : "border-border bg-surface hover:-translate-y-0.5 hover:shadow-soft"
                        }`}
                      >
                        <span className="label-eyebrow text-muted-foreground">{s.category}</span>
                        <span className="mt-1.5 block font-display text-base font-semibold">
                          {s.title}
                        </span>
                        <span className="mt-1.5 block text-xs text-muted-foreground">
                          {s.short}
                        </span>
                      </button>
                    ))}
                    <FieldError msg={errors["service"]} />
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <ChipGroup
                      options={buildingTypes}
                      value={form.buildingType}
                      onChange={(v) => set("buildingType", v)}
                    />
                    <FieldError msg={errors["buildingType"]} />
                    <div className="mt-6">
                      <WField label="Szintek száma">
                        <ChipGroup
                          options={levelOptions}
                          value={form.levels}
                          onChange={(v) => set("levels", v)}
                        />
                      </WField>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <WField label="Irányítószám" error={errors["zip"]}>
                      <Input
                        value={form.zip}
                        inputMode="numeric"
                        maxLength={4}
                        onChange={(e) => set("zip", e.target.value)}
                        placeholder="5000"
                      />
                    </WField>
                    <WField label="Település *" error={errors["city"]}>
                      <Input
                        value={form.city}
                        onChange={(e) => set("city", e.target.value)}
                        placeholder="Szolnok"
                      />
                    </WField>
                    <WField label="Utca, házszám" className="sm:col-span-2">
                      <Input
                        value={form.street}
                        onChange={(e) => set("street", e.target.value)}
                        placeholder="Példa utca 12."
                      />
                    </WField>
                    <WField label="Megközelíthetőség" className="sm:col-span-2">
                      <ChipGroup
                        options={accessOptions}
                        value={form.access}
                        onChange={(v) => set("access", v)}
                      />
                    </WField>
                  </div>
                )}

                {step === 4 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <WField label="Hozzávetőleges tetőfelület (m²)" error={errors["area"]}>
                      <Input
                        value={form.area}
                        inputMode="decimal"
                        onChange={(e) => set("area", e.target.value)}
                        placeholder="120"
                      />
                    </WField>
                    <WField label="A tető kora (év)">
                      <Input
                        value={form.age}
                        onChange={(e) => set("age", e.target.value)}
                        placeholder="22"
                      />
                    </WField>
                    <WField label="Tetőforma *" error={errors["shape"]} className="sm:col-span-2">
                      <ChipGroup
                        options={roofShapes}
                        value={form.shape}
                        onChange={(v) => set("shape", v)}
                      />
                    </WField>
                    <WField label="Jelenlegi héjazat" className="sm:col-span-2">
                      <ChipGroup
                        options={coverings}
                        value={form.covering}
                        onChange={(v) => set("covering", v)}
                      />
                    </WField>
                    <WField label="Rövid leírás a tapasztalt hibáról" className="sm:col-span-2">
                      <Textarea
                        rows={3}
                        value={form.roofDescription}
                        onChange={(e) => set("roofDescription", e.target.value)}
                        placeholder="Például: a kémény melletti szegélynél csöpög a víz."
                      />
                    </WField>

                    {serviceFields.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="label-eyebrow text-accent">
                          Kiegészítő kérdések — {form.service}
                        </p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          {serviceFields.map((f) => (
                            <CustomFieldInput
                              key={f.id}
                              field={f}
                              value={form.extra[f.key] ?? ""}
                              error={errors[`extra-${f.key}`]}
                              onChange={(v) =>
                                setForm((prev) => ({
                                  ...prev,
                                  extra: { ...prev.extra, [f.key]: v },
                                }))
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-3">
                    {urgencyOptions.map((u) => (
                      <button
                        key={u.key}
                        onClick={() => set("urgency", u.key)}
                        className={`flex w-full items-start gap-3 rounded-[var(--radius-card)] border p-4 text-left transition-all ${
                          form.urgency === u.key
                            ? "border-accent bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
                            : "border-border bg-surface hover:shadow-soft"
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                            form.urgency === u.key ? "border-accent bg-accent" : "border-input"
                          }`}
                        >
                          {form.urgency === u.key ? (
                            <Check className="h-3 w-3 text-accent-foreground" />
                          ) : null}
                        </span>
                        <span>
                          <span className="block font-semibold">{urgencyLabels[u.key]}</span>
                          <span className="block text-xs text-muted-foreground">{u.note}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 6 && (
                  <FileStep
                    files={form.files}
                    updateFiles={updateFiles}
                    uploadState={uploadState}
                    setUploadState={setUploadState}
                    pending={pendingFiles}
                  />
                )}

                {step === 7 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <WField label="Név *" error={errors["name"]}>
                      <Input
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="Varga Ildikó"
                        maxLength={80}
                      />
                    </WField>
                    <WField label="Telefonszám *" error={errors["phone"]}>
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder="+36 30 000 0000"
                        maxLength={24}
                      />
                    </WField>
                    <WField label="E-mail cím" error={errors["email"]}>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        placeholder="nev@example.hu"
                        maxLength={120}
                      />
                    </WField>
                    <WField label="Preferált kapcsolattartás">
                      <ChipGroup
                        options={contactPrefs}
                        value={form.preferredContact}
                        onChange={(v) => set("preferredContact", v)}
                      />
                    </WField>
                    <WField label="Mikor hívhatunk?" className="sm:col-span-2">
                      <ChipGroup
                        options={callWindows}
                        value={form.callWindow}
                        onChange={(v) => set("callWindow", v)}
                      />
                    </WField>
                    <WField label="Üzenet" className="sm:col-span-2">
                      <Textarea
                        rows={4}
                        maxLength={1000}
                        value={form.message}
                        onChange={(e) => set("message", e.target.value)}
                        placeholder="Bármi, amit fontosnak tartasz a felmérés előtt."
                      />
                    </WField>
                  </div>
                )}

                {step === 8 && (
                  <Summary form={form} goTo={goTo} serviceFields={serviceFields}>
                    <label className="mt-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-xs text-muted-foreground">
                      <Checkbox
                        checked={form.consent}
                        onCheckedChange={(v) => set("consent", Boolean(v))}
                      />
                      <span>
                        Elfogadom az adatkezelési tájékoztatót, és hozzájárulok, hogy a megadott
                        adatokat ajánlatadás és kapcsolatfelvétel céljából kezeljék.{" "}
                        <Link
                          to="/jogi/$slug"
                          params={{ slug: "adatkezelesi-tajekoztato" }}
                          className="font-semibold text-foreground underline"
                        >
                          Adatkezelési tájékoztató
                        </Link>
                      </span>
                    </label>
                    <FieldError msg={errors["consent"]} />
                  </Summary>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>

      <div className="fixed inset-x-0 bottom-0 z-60 border-t border-border bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] backdrop-blur-xl">
        <Container className="flex items-center justify-between gap-3 py-3">
          <Button variant="outline" onClick={back} disabled={step === 1}>
            <ArrowLeft /> Vissza
          </Button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {editableStepShort[step - 1]} — {step}/8
          </span>
          {step < 8 ? (
            <Button variant="ink" onClick={next}>
              Tovább <ArrowRight />
            </Button>
          ) : (
            <div className="text-right">
              {submitError ? (
                <p role="alert" className="mb-2 max-w-md text-left text-xs text-destructive">
                  {submitError}
                </p>
              ) : null}
              {failedCount > 0 ? (
                <p role="status" className="mb-2 max-w-md text-left text-xs text-destructive">
                  {failedCount} kép feltöltése nem sikerült — ezekből csak a fájlnév jut el hozzánk.
                  A 6. lépésben újrapróbálhatod, vagy beküldheted így is.
                </p>
              ) : null}
              <Button
                variant="copper"
                onClick={() => void submit()}
                disabled={submitting || uploadingCount > 0}
              >
                {submitting
                  ? value("submitting", "Mentés…")
                  : uploadingCount > 0
                    ? "Képek feltöltése…"
                    : value("submit", "Ajánlatkérés beküldése")}{" "}
                <Check />
              </Button>
            </div>
          )}
        </Container>
      </div>
    </div>
  );
}

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };
const isTextControl = (node: React.ReactNode): node is React.ReactElement<ControlProps> =>
  isValidElement(node) && (node.type === Input || node.type === Textarea || node.type === "select");

// A visible label is not a label to assistive technology unless it is linked
// to its control. A text input / textarea / select child is linked with
// for/id (and told about its error message); anything else — a group of
// chips — becomes a labelled group instead.
function WField({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const errorId = error ? `${baseId}-error` : undefined;
  const hasControl = Children.toArray(children).some(isTextControl);
  const content = Children.map(children, (node) =>
    isTextControl(node)
      ? cloneElement(node, {
          id: node.props.id ?? baseId,
          ...(errorId ? { "aria-invalid": true, "aria-describedby": errorId } : {}),
        })
      : node,
  );
  return (
    <div
      className={`space-y-2 ${className}`}
      {...(hasControl ? {} : { role: "group", "aria-labelledby": labelId })}
    >
      <Label
        id={labelId}
        htmlFor={hasControl ? baseId : undefined}
        className="text-xs font-semibold text-muted-foreground"
      >
        {label}
      </Label>
      {content}
      <FieldError msg={error} id={errorId} />
    </div>
  );
}

function FieldError({ msg, id }: { msg?: string | undefined; id?: string | undefined }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {msg}
    </p>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}

          className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${
            value === o
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: CustomField;
  value: string;
  error?: string | undefined;
  onChange: (v: string) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const common = { error, label } as const;

  if (field.type === "hosszu-szoveg")
    return (
      <WField {...common} className="sm:col-span-2">
        <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      </WField>
    );
  if (field.type === "igen-nem")
    return (
      <WField {...common}>
        <ChipGroup options={["Igen", "Nem"]} value={value} onChange={onChange} />
      </WField>
    );
  if (field.type === "valasztogomb" || field.type === "tobb-valasztas")
    return (
      <WField {...common}>
        <ChipGroup options={field.options} value={value} onChange={onChange} />
      </WField>
    );
  if (field.type === "legordulo")
    return (
      <WField {...common}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-[var(--radius-button)] border border-input bg-surface px-3 text-sm"
        >
          <option value="">Válassz…</option>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </WField>
    );
  if (field.type === "fajl" || field.type === "fotó")
    return (
      <WField {...common}>
        <p className="rounded-[var(--radius-button)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          A fájlokat a következő „Képek és dokumentumok” lépésben tudod feltölteni.
        </p>
      </WField>
    );

  const inputType =
    field.type === "szam" || field.type === "terulet" || field.type === "mennyiseg"
      ? "number"
      : field.type === "datum"
        ? "date"
        : "text";

  return (
    <WField {...common}>
      <Input type={inputType} value={value} onChange={(e) => onChange(e.target.value)} />
      {field.description ? (
        <p className="text-[11px] text-muted-foreground">{field.description}</p>
      ) : null}
    </WField>
  );
}

const UPLOADABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_WIZARD_FILES = 10; // the server accepts at most 10 files per request
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // the public upload endpoint's limit
const MAX_DOCUMENT_BYTES = 20_000_000; // the lead schema's per-file size limit

type UploadState = "uploading" | "failed";
type UploadStates = Record<string, UploadState>;

// Resolves to the stored photo's URL, or a message that can be shown to the
// visitor — never throws, so one bad photo can't break the wizard.
async function uploadLeadPhoto(file: File): Promise<{ url: string } | { error: string }> {
  try {
    const res = await fetch("/api/leads/media", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (res.ok && body?.url) return { url: body.url };
    if (res.status === 429) {
      return { error: "Túl sok feltöltés rövid idő alatt — próbáld újra pár perc múlva." };
    }
    return { error: body?.error ?? "A feltöltés nem sikerült." };
  } catch {
    return { error: "A feltöltés megszakadt — ellenőrizd a kapcsolatot." };
  }
}

// Draft persistence keeps only what survives a refresh: documents (filename
// only, by design) and photos that actually reached the server. A photo that
// never uploaded has no binary left after a reload, so it can't be sent.
function persistableFiles(files: DemoFile[]): DemoFile[] {
  return files
    .filter((f) => f.url || f.kind === "dokumentum")
    .map(({ dataUrl: _preview, ...rest }) => rest);
}

function FileStep({
  files,
  updateFiles,
  uploadState,
  setUploadState,
  pending,
}: {
  files: DemoFile[];
  updateFiles: (updater: (prev: DemoFile[]) => DemoFile[]) => void;
  uploadState: UploadStates;
  setUploadState: (updater: (prev: UploadStates) => UploadStates) => void;
  /** The browser-side File objects of photos still uploading or failed (for retry). */
  pending: React.RefObject<Map<string, File>>;
}) {
  const [drag, setDrag] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const filesRef = useRef<DemoFile[]>(files);
  filesRef.current = files;

  const startUpload = (id: string, file: File) => {
    pending.current?.set(id, file);
    setUploadState((s) => ({ ...s, [id]: "uploading" }));
    void uploadLeadPhoto(file).then((result) => {
      if ("url" in result) {
        pending.current?.delete(id);
        // A functional update: another photo may have been added or removed
        // while this one was in flight — a stale snapshot would undo that.
        updateFiles((prev) => prev.map((f) => (f.id === id ? { ...f, url: result.url } : f)));
        setUploadState((s) => {
          const { [id]: _done, ...rest } = s;
          return rest;
        });
      } else {
        setUploadState((s) => ({ ...s, [id]: "failed" }));
        setNotices((n) => [...n, `${file.name}: ${result.error}`]);
      }
    });
  };

  const handle = (list: FileList | null) => {
    if (!list) return;
    const problems: string[] = [];
    const accepted: { entry: DemoFile; file: File | null }[] = [];
    let room = MAX_WIZARD_FILES - filesRef.current.length;

    for (const file of Array.from(list)) {
      const isImage = file.type.startsWith("image/");
      if (room <= 0) {
        problems.push(`${file.name}: legfeljebb ${MAX_WIZARD_FILES} fájlt csatolhatsz.`);
        continue;
      }
      if (isImage && !UPLOADABLE_TYPES.has(file.type)) {
        problems.push(`${file.name}: csak JPEG, PNG, WebP vagy AVIF kép tölthető fel.`);
        continue;
      }
      if (isImage && file.size > MAX_PHOTO_BYTES) {
        problems.push(`${file.name}: a kép legfeljebb 8 MB lehet.`);
        continue;
      }
      if (!isImage && file.size > MAX_DOCUMENT_BYTES) {
        problems.push(`${file.name}: a dokumentum legfeljebb 20 MB lehet.`);
        continue;
      }
      room -= 1;
      accepted.push({
        entry: {
          id: newId("file"),
          name: file.name,
          size: file.size,
          kind: isImage ? "kep" : "dokumentum",
          // A local preview of any size (an object URL, not a base64 copy in
          // memory); it is never sent or stored.
          ...(isImage ? { dataUrl: URL.createObjectURL(file) } : {}),
        },
        file: isImage ? file : null,
      });
    }

    setNotices(problems);
    if (accepted.length === 0) return;
    updateFiles((prev) => [...prev, ...accepted.map((a) => a.entry)]);
    for (const { entry, file } of accepted) if (file) startUpload(entry.id, file);
  };

  const retry = (id: string) => {
    const file = pending.current?.get(id);
    if (file) startUpload(id, file);
  };

  const remove = (f: DemoFile) => {
    if (f.dataUrl?.startsWith("blob:")) URL.revokeObjectURL(f.dataUrl);
    pending.current?.delete(f.id);
    setUploadState((s) => {
      const { [f.id]: _gone, ...rest } = s;
      return rest;
    });
    updateFiles((prev) => prev.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-5">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-10 text-center transition-colors ${
          drag
            ? "border-accent bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
            : "border-border bg-surface"
        }`}
      >
        <CloudUpload className="h-8 w-8 text-accent" />
        <span className="font-display text-lg font-semibold">
          Húzd ide a képeket, vagy kattints a tallózáshoz
        </span>
        <span className="max-w-md text-xs text-muted-foreground">
          Fénykép a beázás helyéről, a tetőről kívülről, a padlástérről belülről (JPEG, PNG, WebP
          vagy AVIF, képenként legfeljebb 8 MB, összesen legfeljebb {MAX_WIZARD_FILES} fájl).
          Dokumentum is csatolható: terv, korábbi ajánlat, kárfelvételi jegyzőkönyv — ezeknél
          egyelőre csak a fájlnevet kapjuk meg, a képek viszont a feltöltéskor automatikusan
          elküldésre kerülnek hozzánk.
        </span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            // Copy the FileList before clearing the input: the same file can
            // then be picked again (e.g. to retry after a refusal).
            const picked = e.target.files;
            handle(picked);
            e.target.value = "";
          }}
        />
      </label>

      {notices.length > 0 ? (
        <ul role="alert" className="space-y-1 text-xs text-destructive">
          {notices.map((n, i) => (
            <li key={`${n}-${i}`}>{n}</li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {files.map((f) => {
            const state = uploadState[f.id];
            const preview = f.dataUrl ?? f.url;
            return (
              <div
                key={f.id}
                className="group relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
              >
                {preview ? (
                  <img src={preview} alt={f.name} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-muted">
                    {f.kind === "kep" ? (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 p-2.5">
                  <div className="min-w-0">
                    <span className="block truncate text-xs" title={f.name}>
                      {f.name}
                    </span>
                    <span
                      className={`block text-[11px] ${
                        state === "failed" ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {state === "uploading"
                        ? "Feltöltés…"
                        : state === "failed"
                          ? "Nem sikerült feltölteni"
                          : f.url
                            ? "Feltöltve ✓"
                            : "Csak a fájlnév kerül elküldésre"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {state === "failed" && pending.current?.has(f.id) ? (
                      <button
                        type="button"
                        onClick={() => retry(f.id)}
                        className="rounded-full px-2 py-1 text-[11px] font-semibold text-accent hover:bg-muted"
                      >
                        Újra
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove(f)}
                      aria-label={`${f.name} törlése`}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ez a lépés kihagyható, de fényképekkel lényegesen pontosabb előzetes véleményt tudunk
          adni.
        </p>
      )}
    </div>
  );
}

function Summary({
  form,
  goTo,
  serviceFields,
  children,
}: {
  form: WizardForm;
  goTo: (s: number) => void;
  serviceFields: CustomField[];
  children: React.ReactNode;
}) {
  const groups: { step: number; title: string; rows: [string, string][] }[] = [
    { step: 1, title: "Szolgáltatás", rows: [["Kért munka", form.service || "—"]] },
    {
      step: 2,
      title: "Épület",
      rows: [
        ["Épület típusa", form.buildingType || "—"],
        ["Szintek", form.levels || "—"],
      ],
    },
    {
      step: 3,
      title: "Helyszín",
      rows: [
        ["Cím", [form.zip, form.city, form.street].filter(Boolean).join(" ") || "—"],
        ["Megközelítés", form.access || "—"],
      ],
    },
    {
      step: 4,
      title: "Tetőadatok",
      rows: [
        ["Tetőfelület", form.area ? `${form.area} m²` : "—"],
        ["Forma", form.shape || "—"],
        ["Héjazat", form.covering || "—"],
        ["Kor", form.age || "—"],
        ["Leírás", form.roofDescription || "—"],
        ...serviceFields.map((f) => [f.label, form.extra[f.key] || "—"] as [string, string]),
      ],
    },
    { step: 5, title: "Sürgősség", rows: [["Igény", urgencyLabels[form.urgency] ?? "—"]] },
    {
      step: 6,
      title: "Feltöltött fájlok",
      rows: [["Fájlok", form.files.length ? form.files.map((f) => f.name).join(", ") : "Nincs"]],
    },
    {
      step: 7,
      title: "Kapcsolat",
      rows: [
        ["Név", form.name || "—"],
        ["Telefon", form.phone || "—"],
        ["E-mail", form.email || "—"],
        ["Kapcsolattartás", `${form.preferredContact} — ${form.callWindow}`],
        ["Üzenet", form.message || "—"],
      ],
    },
  ];

  return (
    <div>
      <div className="space-y-3">
        {groups.map((g) => (
          <section
            key={g.step}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
          >
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold">{g.title}</h2>
              <button
                onClick={() => goTo(g.step)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" /> Szerkesztés
              </button>
            </header>
            <dl className="mt-3 space-y-2">
              {g.rows.map(([k, v]) => (
                <div key={k} className="grid gap-0.5 text-sm sm:grid-cols-[180px_1fr] sm:gap-4">
                  <dt className="text-xs font-semibold text-muted-foreground">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {children}
    </div>
  );
}

function Confirmation({ lead, phone }: { lead: Lead; phone: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5 py-16 text-ink-foreground">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl text-center"
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold sm:text-4xl">
          Megkaptuk az ajánlatkérésedet
        </h1>
        <p className="mt-4 text-sm text-[color-mix(in_oklab,var(--ink-foreground)_75%,transparent)]">
          A megadott elérhetőségen keresünk, jellemzően egy munkanapon belül. Addig is áttekintjük a
          feltöltött fényképeket és a tetőadatokat.
        </p>

        <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[color-mix(in_oklab,white_12%,transparent)] text-left sm:grid-cols-3">
          <Info label="Azonosító" value={lead.id.toUpperCase()} />
          <Info label="Szolgáltatás" value={lead.service} />
          <Info label="Helyszín" value={lead.city} />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {demoUiEnabled ? (
            <Button asChild variant="copper" size="lg">
              <Link to="/admin/erdeklodok">Megnézem a demó adminfelületen</Link>
            </Button>
          ) : null}
          <Button asChild variant="hairline" size="lg">
            <Link to="/">
              <Home /> Vissza a főoldalra
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-[color-mix(in_oklab,var(--ink-foreground)_55%,transparent)]">
          Sürgős esetben hívj minket:{" "}
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold underline">
            {phone}
          </a>
        </p>
      </motion.div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink p-4">
      <p className="label-eyebrow text-accent">{label}</p>
      <p className="mt-1.5 text-sm font-semibold break-words">{value}</p>
    </div>
  );
}
