import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { DemoProvider, BrandingScope } from "../demo/store";
import { CallbackProvider } from "../demo/ui";
import { DemoBar } from "../components/site/DemoBar";
import { SiteIdentity } from "../components/site/SiteIdentity";
import { ConsentProvider } from "../components/site/ConsentBanner";
import { Toaster } from "../components/ui/sonner";
import { demoUiEnabled } from "../lib/features";
import { initAnalytics, trackPageView } from "../lib/analytics";
import { captureAttributionFromUrl } from "../lib/attribution";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Az oldal nem található</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A keresett oldal nem létezik vagy időközben átkerült máshová.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Vissza a kezdőlapra
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Visitors get the friendly message only (never an error text or a stack).
  // In the admin area — a signed-in owner — the error message itself is shown
  // too, so a failure can be reported or diagnosed without opening DevTools.
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Ez az oldal nem töltődött be
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Váratlan hiba történt. Próbáld újra, vagy térj vissza a kezdőlapra.
        </p>
        {inAdmin && error?.message ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left text-xs break-words whitespace-pre-wrap text-muted-foreground">
            {error.message.slice(0, 600)}
          </pre>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Újrapróbálom
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-[var(--radius-button)] border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Kezdőlap
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { title: "TetőVonal | Tetőfedés és kivitelezés" },
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "TetőVonal" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(import.meta.env["VITE_GOOGLE_SITE_VERIFICATION"]
        ? [
            {
              name: "google-site-verification",
              content: import.meta.env["VITE_GOOGLE_SITE_VERIFICATION"] as string,
            },
          ]
        : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Analytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // If consent was granted while this browser was on the public site
  // earlier, the admin's own /admin/* activity shouldn't still be reported
  // alongside real customer behavior — an admin's page views and actions
  // aren't customer conversions and would otherwise pollute GA4/Meta data
  // (and, incidentally, keep those SDKs from making any further calls at
  // all while working in the admin tool).
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (isAdminRoute) return;
    captureAttributionFromUrl();
    initAnalytics();
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) return;
    // Deferred (not requestAnimationFrame — that never fires while the tab
    // is backgrounded, which would silently drop the event) so TanStack
    // Router's <HeadContent/> has applied the new <title> by the time we read it.
    const timer = setTimeout(() => trackPageView(pathname, document.title), 50);
    return () => clearTimeout(timer);
  }, [pathname, isAdminRoute]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <DemoProvider>
        <CallbackProvider>
          <ConsentProvider>
            <BrandingScope className="min-h-screen bg-background text-foreground">
              <SiteIdentity />
              <Analytics />
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
              {demoUiEnabled ? <DemoBar /> : null}
              <Toaster position="top-center" />
            </BrandingScope>
          </ConsentProvider>
        </CallbackProvider>
      </DemoProvider>
    </QueryClientProvider>
  );
}
