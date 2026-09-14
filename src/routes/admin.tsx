import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  Users,
  Inbox,
  FileText,
  Wrench,
  SlidersHorizontal,
  Images,
  LayoutTemplate,
  Scale,
  Settings as SettingsIcon,
  Palette,
  Menu,
  X,
  ArrowLeft,
  LogOut,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/demo/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Adminfelület — TetőVonal" },
      {
        name: "description",
        content:
          "Védett adminfelület érdeklődők, árajánlatok, szolgáltatások és weboldaltartalmak kezeléséhez.",
      },
      { property: "og:title", content: "Adminfelület — TetőVonal" },
      { property: "og:description", content: "Érdeklődők, ajánlatok és arculat egy helyen." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

export const adminNav = [
  { to: "/admin", label: "Vezérlőpult", icon: LayoutDashboard },
  { to: "/admin/erdeklodok", label: "Érdeklődők", icon: Users },
  { to: "/admin/ajanlatkeresek", label: "Ajánlatkérések", icon: Inbox },
  { to: "/admin/arajanlatok", label: "Árajánlatok", icon: FileText },
  { to: "/admin/szolgaltatasok", label: "Szolgáltatások", icon: Wrench },
  { to: "/admin/tulajdonsagok", label: "Tulajdonságkezelő", icon: SlidersHorizontal },
  { to: "/admin/referenciak", label: "Referenciák", icon: Images },
  { to: "/admin/tartalmak", label: "Tartalmak", icon: LayoutTemplate },
  { to: "/admin/jogi-oldalak", label: "Jogi oldalak", icon: Scale },
  { to: "/admin/beallitasok", label: "Beállítások", icon: SettingsIcon },
  { to: "/admin/arculat", label: "Arculat", icon: Palette },
] as const;

function AdminLogin() {
  const { login, backendAvailable } = useDemo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await login(email, password);
    setError(message);
    setSubmitting(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5 py-12 text-ink-foreground">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-white/10 bg-surface p-6 text-foreground shadow-lift sm:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">Admin belépés</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A kezelőfelület és az ügyféladatok csak hitelesített tulajdonosi fiókkal érhetők el.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">E-mail cím</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Jelszó</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!backendAvailable ? (
            <p className="text-xs text-muted-foreground">
              A szerverkapcsolat jelenleg nem érhető el.
            </p>
          ) : null}
          <Button type="submit" variant="copper" className="w-full" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            Belépés
          </Button>
        </form>

        <Button asChild variant="ghost" className="mt-3 w-full">
          <Link to="/">
            <ArrowLeft /> Vissza a weboldalra
          </Link>
        </Button>
      </div>
    </main>
  );
}

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { ready, authenticated, authUser, logout, syncError } = useDemo();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-ink-foreground">
        <LoaderCircle className="h-7 w-7 animate-spin text-accent" aria-label="Betöltés" />
      </div>
    );
  }

  if (!authenticated) return <AdminLogin />;

  const items = (
    <nav className="space-y-1">
      {adminNav.map((n) => {
        const active = n.to === "/admin" ? pathname === "/admin" : pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-[var(--radius-button)] px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-accent text-accent-foreground font-semibold"
                : "text-[color-mix(in_oklab,var(--sidebar-foreground)_90%,transparent)] hover:bg-[color-mix(in_oklab,white_8%,transparent)]"
            }`}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="sticky top-0 z-70 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-ink px-3 py-2.5 text-ink-foreground sm:px-4 sm:gap-3">
        <div className="min-w-0">
          <span className="label-eyebrow block truncate text-accent">Védett adminfelület</span>
          {syncError ? (
            <span className="block truncate text-[10px] text-red-300">{syncError}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden max-w-48 truncate text-xs text-white/60 xl:inline">
            {authUser?.email}
          </span>
          <Button asChild size="sm" variant="hairline">
            <Link to="/">
              <ArrowLeft /> <span className="hidden sm:inline">Vissza a weboldalra</span>
              <span className="sr-only sm:hidden">Vissza a weboldalra</span>
            </Link>
          </Button>
          <Button size="sm" variant="hairline" onClick={() => void logout()}>
            <LogOut /> <span className="hidden sm:inline">Kilépés</span>
          </Button>
          <button
            onClick={() => setOpen(true)}
            aria-label="Adminmenü megnyitása"
            className="shrink-0 rounded-full p-2 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex w-full">
        <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-3 text-sidebar-foreground lg:flex lg:min-h-[calc(100vh-3.25rem)]">
          <div>{items}</div>
        </aside>

        {open ? (
          <div className="fixed inset-0 z-90 lg:hidden">
            <button
              aria-label="Menü bezárása"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink/70"
            />
            <div className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain bg-sidebar p-3 text-sidebar-foreground">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="label-eyebrow text-accent">Adminmenü</span>
                <button onClick={() => setOpen(false)} aria-label="Bezárás" className="p-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {items}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-3 py-6 sm:px-6 sm:py-8">
          {/* Required: nested admin routes render here. */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
