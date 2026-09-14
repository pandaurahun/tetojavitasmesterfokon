import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Inbox,
  FileText,
  Wrench,
  SlidersHorizontal,
  Images,
  Megaphone,
  LayoutTemplate,
  Scale,
  Settings as SettingsIcon,
  Palette,
  Menu,
  X,
  ArrowLeft,
  LogOut,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/tartalmak", label: "Tartalmak", icon: LayoutTemplate },
  { to: "/admin/jogi-oldalak", label: "Jogi oldalak", icon: Scale },
  { to: "/admin/beallitasok", label: "Beállítások", icon: SettingsIcon },
  { to: "/admin/arculat", label: "Arculat", icon: Palette },
] as const;

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { ready, authenticated, authUser, logout, syncError } = useDemo();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isLoginRoute = pathname === "/admin/login";

  useEffect(() => {
    if (ready && !authenticated && !isLoginRoute) {
      void navigate({ to: "/admin/login", replace: true });
    }
  }, [ready, authenticated, isLoginRoute, navigate]);

  if (isLoginRoute) return <Outlet />;

  if (!ready || !authenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-ink-foreground">
        <LoaderCircle className="h-7 w-7 animate-spin text-accent" aria-label="Betöltés" />
      </div>
    );
  }

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
