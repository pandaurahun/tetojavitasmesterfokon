import { createContext, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, PhoneCall, Check } from "lucide-react";
import { useCmsSection, useDemo, newId, nowStamp } from "./store";
import { trackCallbackSubmit } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface CallbackContextValue {
  open: (service?: string) => void;
}

const CallbackContext = createContext<CallbackContextValue>({ open: () => {} });

export const useCallbackModal = () => useContext(CallbackContext);

export function CallbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [service, setService] = useState("Tetőfedés");
  return (
    <CallbackContext.Provider
      value={{
        open: (s) => {
          if (s) setService(s);
          setIsOpen(true);
        },
      }}
    >
      {children}
      <CallbackModal
        isOpen={isOpen}
        service={service}
        setService={setService}
        onClose={() => setIsOpen(false)}
      />
    </CallbackContext.Provider>
  );
}

function CallbackModal({
  isOpen,
  onClose,
  service,
  setService,
}: {
  isOpen: boolean;
  onClose: () => void;
  service: string;
  setService: (s: string) => void;
}) {
  const { addLead, services } = useDemo();
  const { section, value } = useCmsSection("global.callback");
  const callbackWindows = [1, 2, 3, 4].map((index) =>
    value(`when.${index}`, ["Ma délelőtt", "Ma délután", "Holnap", "Munkaidő után"][index - 1]),
  );
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    when: "Ma délután",
    consent: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addLead({
        id: newId("lead"),
        createdAt: new Date().toISOString(),
        name: form.name || "Nem adott meg nevet",
        phone: form.phone,
        email: "",
        city: form.city,
        service,
        urgency: "napokon-belul",
        status: "kapcsolatra-var",
        source: "visszahivas",
        preferredContact: "Telefon",
        callWindow: form.when,
        message: `Visszahívást kért: ${form.when}`,
        files: [],
        owner: "Kovács Tamás",
        nextTask: `Visszahívás: ${form.when}`,
        notes: [],
        timeline: [{ id: newId("tl"), date: nowStamp(), title: "Visszahívás kérés a weboldalról" }],
      });
      trackCallbackSubmit();
      setDone(true);
    } catch {
      setSubmitError("A kérés mentése nem sikerült. Kérjük, próbáld újra vagy hívj minket.");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    onClose();
    setTimeout(() => {
      setDone(false);
      setForm({ name: "", phone: "", city: "", when: "Ma délután", consent: false });
    }, 250);
  };

  return (
    <AnimatePresence>
      {isOpen && section?.visible !== false && (
        <motion.div
          className="fixed inset-0 z-100 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Bezárás"
            onClick={close}
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_70%,transparent)]"
          />
          <motion.div
            initial={{ y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative z-10 w-full max-w-md rounded-t-[var(--radius-card)] bg-surface p-6 shadow-lift sm:rounded-[var(--radius-card)]"
          >
            <button
              onClick={close}
              aria-label="Bezárás"
              className="absolute top-4 right-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            {done ? (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest text-forest-foreground">
                  <Check className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">
                  {value("successTitle", "Rögzítettük a kérést")}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {value(
                    "successText",
                    "A megadott időpontban keresünk telefonon. A kérés biztonságosan bekerült az adminfelület érdeklődői közé.",
                  )}
                </p>
                <Button onClick={close} className="mt-5 w-full" variant="ink">
                  {value("done", "Rendben")}
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex items-center gap-2 text-accent">
                  <PhoneCall className="h-4 w-4" />
                  <span className="label-eyebrow">{value("eyebrow", "Visszahívás")}</span>
                </div>
                <h3 className="text-2xl font-semibold">{value("title", "Mikor hívhatjuk?")}</h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={value("nameLabel", "Név")}>
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={value("namePlaceholder", "Például Varga Ildikó")}
                    />
                  </Field>
                  <Field label={value("phoneLabel", "Telefonszám")}>
                    <Input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder={value("phonePlaceholder", "+36 30 000 0000")}
                    />
                  </Field>
                  <Field label={value("cityLabel", "Település")}>
                    <Input
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder={value("cityPlaceholder", "Például Szolnok")}
                    />
                  </Field>
                  <Field label={value("serviceLabel", "Szolgáltatás")}>
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="h-10 w-full rounded-[var(--radius-button)] border border-input bg-surface px-3 text-sm"
                    >
                      {services
                        .filter((s) => s.active)
                        .map((s) => (
                          <option key={s.id}>{s.title}</option>
                        ))}
                      <option>{value("otherService", "Egyéb kivitelezés")}</option>
                    </select>
                  </Field>
                </div>

                <Field label={value("whenLabel", "Visszahívás időpontja")}>
                  <div className="flex flex-wrap gap-2">
                    {callbackWindows.map((w) => (
                      <button
                        type="button"
                        key={w}
                        onClick={() => setForm({ ...form, when: w })}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          form.when === w
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </Field>

                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={form.consent}
                    onCheckedChange={(v) => setForm({ ...form, consent: Boolean(v) })}
                    required
                  />
                  <span>
                    {value(
                      "consent",
                      "Elfogadom, hogy a megadott adatokat kapcsolatfelvétel céljából kezeljék.",
                    )}
                  </span>
                </label>

                {submitError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="copper"
                  className="w-full"
                  disabled={!form.consent || submitting}
                >
                  {submitting
                    ? value("submitting", "Mentés…")
                    : value("submit", "Visszahívást kérek")}
                </Button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
