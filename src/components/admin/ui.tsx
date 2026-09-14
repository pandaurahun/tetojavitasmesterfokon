import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { statusLabels, quoteStatusLabels, urgencyLabels } from "@/demo/data";

export function AdminPage({
  title,
  intro,
  actions,
  children,
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="font-display text-xl font-semibold text-balance-tight sm:text-3xl">{title}</h1>
          {intro ? <p className="mt-2 text-sm break-words text-muted-foreground">{intro}</p> : null}
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-soft sm:p-6 ${className}`}
    >
      {title || actions ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-base font-semibold break-words sm:text-lg">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs break-words text-muted-foreground">{description}</p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "accent" | "forest" | "danger";
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "forest"
        ? "text-forest"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-soft">
      <p className="label-eyebrow text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    uj: "bg-accent text-accent-foreground",
    "kapcsolatra-var": "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]",
    elfogadva: "bg-forest text-forest-foreground",
    elutasitva: "bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] text-destructive",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        map[status] ?? "bg-muted text-foreground"
      }`}
    >
      {statusLabels[status] ?? quoteStatusLabels[status] ?? status}
    </span>
  );
}

export function UrgencyPill({ urgency }: { urgency: string }) {
  const urgent = urgency === "azonnali" || urgency === "napokon-belul";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        urgent
          ? "bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)] text-destructive"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {urgencyLabels[urgency] ?? urgency}
    </span>
  );
}

export function AdminField({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NativeSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 w-full rounded-[var(--radius-button)] border border-input bg-surface px-3 text-sm ${className}`}
    >
      {children}
    </select>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-[var(--radius-button)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
