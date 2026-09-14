import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { AdminPage, AdminField, Panel } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/store";
import { defaultSettings, owners } from "@/demo/data";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/beallitasok")({
  component: SettingsAdmin,
});

function SettingsAdmin() {
  const { settings, update, leads, quotes, services, projects, fields } = useDemo();
  const set = (patch: Partial<typeof settings>) => update({ settings: { ...settings, ...patch } });

  return (
    <AdminPage
      title="Beállítások"
      intro="Cégadatok, elérhetőségek és szolgáltatási területek. Ezek az adatok a publikus oldal láblécében, a kapcsolati oldalon és az árajánlatokon jelennek meg."
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            update({ settings: defaultSettings });
            toast.success("A beállítások visszaállítva.");
          }}
        >
          Alapértelmezett beállítások
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Cégadatok">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Cégnév" className="sm:col-span-2">
              <Input value={settings.company} onChange={(e) => set({ company: e.target.value })} />
            </AdminField>
            <AdminField label="Kapcsolattartó">
              <Input
                value={settings.contactName}
                onChange={(e) => set({ contactName: e.target.value })}
              />
            </AdminField>
            <AdminField label="Adószám">
              <Input
                value={settings.taxNumber}
                onChange={(e) => set({ taxNumber: e.target.value })}
              />
            </AdminField>
            <AdminField label="Telefonszám">
              <Input value={settings.phone} onChange={(e) => set({ phone: e.target.value })} />
            </AdminField>
            <AdminField label="E-mail cím">
              <Input value={settings.email} onChange={(e) => set({ email: e.target.value })} />
            </AdminField>
            <AdminField label="Székhely" className="sm:col-span-2">
              <Input value={settings.address} onChange={(e) => set({ address: e.target.value })} />
            </AdminField>
            <AdminField label="Nyitvatartás / munkaidő" className="sm:col-span-2">
              <Input
                value={settings.workingHours}
                onChange={(e) => set({ workingHours: e.target.value })}
              />
            </AdminField>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Szolgáltatási területek"
            description="Soronként egy település. A publikus területellenőrző ezt használja."
          >
            <Textarea
              rows={10}
              value={settings.areas.join("\n")}
              onChange={(e) =>
                set({
                  areas: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">{settings.areas.length} település</p>
          </Panel>

          <Panel
            title="Rendszer állapota"
            description="Az adminban kezelt elemek aktuális darabszáma."
          >
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              <Stat label="Érdeklődő" value={leads.length} />
              <Stat label="Árajánlat" value={quotes.length} />
              <Stat label="Szolgáltatás" value={services.length} />
              <Stat label="Referencia" value={projects.length} />
              <Stat label="Egyedi tulajdonság" value={fields.length} />
              <Stat label="Felelős" value={owners.length} />
            </ul>
          </Panel>
        </div>
      </div>

      <PasswordPanel />
    </AdminPage>
  );
}

function PasswordPanel() {
  const { changePassword } = useDemo();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("A két új jelszó nem egyezik.");
      return;
    }
    setSubmitting(true);
    const message = await changePassword(currentPassword, newPassword);
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("A jelszó módosítva.");
  };

  return (
    <Panel
      title="Fiókbiztonság"
      description="A jelszó módosítása minden más aktív munkamenetet kijelentkeztet, ez a böngésző marad bejelentkezve."
      className="max-w-xl"
    >
      <form onSubmit={submit} className="grid gap-3">
        <AdminField label="Jelenlegi jelszó">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </AdminField>
        <AdminField label="Új jelszó" hint="Legalább 12 karakter.">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </AdminField>
        <AdminField label="Új jelszó megerősítése">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </AdminField>
        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="copper" disabled={submitting} className="w-fit">
          {submitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
          Jelszó módosítása
        </Button>
      </form>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between rounded-[var(--radius-button)] border border-border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </li>
  );
}
