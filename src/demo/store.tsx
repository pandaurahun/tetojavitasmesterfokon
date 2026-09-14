import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { articles as staticArticles, defaultBranding } from "./data";
import { initialState, type DemoState } from "./default-state";
import type {
  Branding,
  ContentBlock,
  CmsSection,
  CustomField,
  Lead,
  LegalDoc,
  ProjectRef,
  Quote,
  ServiceItem,
  Settings,
} from "./types";

export type AuthUser = { email: string; role: string };

interface DemoContextValue extends DemoState {
  articles: typeof staticArticles;
  ready: boolean;
  authenticated: boolean;
  authUser: AuthUser | null;
  backendAvailable: boolean;
  syncError: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  uploadMedia: (file: File) => Promise<string>;
  update: (patch: Partial<DemoState>) => void;
  addLead: (lead: Lead) => Promise<void>;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  upsertQuote: (quote: Quote) => void;
  upsertService: (service: ServiceItem) => void;
  removeService: (id: string) => void;
  upsertField: (field: CustomField) => void;
  removeField: (id: string) => void;
  upsertProject: (project: ProjectRef) => void;
  removeProject: (id: string) => void;
  moveProject: (id: string, direction: -1 | 1) => void;
  setBranding: (patch: Partial<Branding>) => void;
  resetBranding: () => void;
  updateContent: (id: string, patch: Partial<ContentBlock>) => void;
  updateCmsSection: (id: string, patch: Partial<Omit<CmsSection, "id">>) => void;
  updateCmsValue: (id: string, key: string, value: string) => void;
  updateLegal: (id: string, patch: Partial<LegalDoc>) => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(initialState);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const adminModeRef = useRef(false);
  const authenticatedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const pendingStateRef = useRef<DemoState | null>(null);

  const loadAdminState = useCallback(async () => {
    const response = await fetch("/api/admin/state", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Az adminadatok betöltése nem sikerült.");
    const next = (await response.json()) as DemoState;
    setState(next);
  }, []);

  useEffect(() => {
    let active = true;
    adminModeRef.current = window.location.pathname.startsWith("/admin");
    const load = async () => {
      try {
        if (adminModeRef.current) {
          const session = await fetch("/api/admin/session", {
            headers: { Accept: "application/json" },
          });
          if (session.status === 401) {
            if (active) {
              setAuthenticated(false);
              setAuthUser(null);
              setBackendAvailable(true);
            }
            return;
          }
          if (!session.ok) throw new Error("A backend nem érhető el.");
          const payload = (await session.json()) as { user: AuthUser };
          authenticatedRef.current = true;
          if (active) {
            setAuthenticated(true);
            setAuthUser(payload.user);
          }
          await loadAdminState();
        } else {
          const response = await fetch("/api/public-state", {
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error("A publikus adatok betöltése nem sikerült.");
          const next = (await response.json()) as DemoState;
          if (active) setState(next);
        }
        if (active) setBackendAvailable(true);
      } catch {
        if (active) {
          setBackendAvailable(false);
          setState(initialState);
        }
      } finally {
        if (active) setReady(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadAdminState]);

  const persistState = useCallback(async (next: DemoState) => {
    const response = await fetch("/api/admin/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) throw new Error("A mentés nem sikerült.");
  }, []);

  const queueSave = useCallback(
    (next: DemoState) => {
      if (!adminModeRef.current || !authenticatedRef.current) return;
      pendingStateRef.current = next;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        const pending = pendingStateRef.current;
        pendingStateRef.current = null;
        saveTimerRef.current = null;
        if (!pending) return;
        void persistState(pending)
          .then(() => setSyncError(null))
          .catch(() => setSyncError("A legutóbbi módosítás nem került a szerverre."));
      }, 500);
    },
    [persistState],
  );

  const mutate = useCallback(
    (recipe: (previous: DemoState) => DemoState) => {
      setState((previous) => {
        const next = recipe(previous);
        queueSave(next);
        return next;
      });
    },
    [queueSave],
  );

  const update = useCallback(
    (patch: Partial<DemoState>) => mutate((previous) => ({ ...previous, ...patch })),
    [mutate],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          user?: AuthUser;
          error?: string;
        };
        if (!response.ok || !payload.user) return payload.error ?? "A belépés nem sikerült.";
        authenticatedRef.current = true;
        setAuthenticated(true);
        setAuthUser(payload.user);
        setBackendAvailable(true);
        await loadAdminState();
        return null;
      } catch {
        setBackendAvailable(false);
        return "A backend nem érhető el. Indítsd a Cloudflare helyi előnézetet.";
      }
    },
    [loadAdminState],
  );

  const logout = useCallback(async () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    const pending = pendingStateRef.current;
    pendingStateRef.current = null;
    if (pending) await persistState(pending).catch(() => undefined);
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    authenticatedRef.current = false;
    setAuthenticated(false);
    setAuthUser(null);
    setState(initialState);
  }, [persistState]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<string | null> => {
      try {
        const response = await fetch("/api/admin/password", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) return payload.error ?? "A jelszó módosítása nem sikerült.";
        return null;
      } catch {
        return "A backend nem érhető el.";
      }
    },
    [],
  );

  const uploadMedia = useCallback(async (file: File): Promise<string> => {
    const response = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url)
      throw new Error(payload.error ?? "A képfeltöltés nem sikerült.");
    return payload.url;
  }, []);

  const value = useMemo<DemoContextValue>(() => {
    return {
      ...state,
      articles: staticArticles,
      ready,
      authenticated,
      authUser,
      backendAvailable,
      syncError,
      login,
      logout,
      changePassword,
      uploadMedia,
      update,
      addLead: async (lead) => {
        const persistedLead: Lead = {
          ...lead,
          files: lead.files.map(({ dataUrl: _dataUrl, ...file }) => file),
        };
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(persistedLead),
        });
        if (!response.ok) throw new Error("Az ajánlatkérés mentése nem sikerült.");
        mutate((p) => ({ ...p, leads: [persistedLead, ...p.leads] }));
      },
      updateLead: (id, patch) =>
        mutate((p) => ({
          ...p,
          leads: p.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      upsertQuote: (quote) =>
        mutate((p) => ({
          ...p,
          quotes: p.quotes.some((q) => q.id === quote.id)
            ? p.quotes.map((q) => (q.id === quote.id ? quote : q))
            : [quote, ...p.quotes],
        })),
      upsertService: (service) =>
        mutate((p) => ({
          ...p,
          services: p.services.some((s) => s.id === service.id)
            ? p.services.map((s) => (s.id === service.id ? service : s))
            : [...p.services, service],
        })),
      removeService: (id) =>
        mutate((p) => ({ ...p, services: p.services.filter((s) => s.id !== id) })),
      upsertField: (field) =>
        mutate((p) => ({
          ...p,
          fields: p.fields.some((f) => f.id === field.id)
            ? p.fields.map((f) => (f.id === field.id ? field : f))
            : [...p.fields, field],
        })),
      removeField: (id) => mutate((p) => ({ ...p, fields: p.fields.filter((f) => f.id !== id) })),
      upsertProject: (project) =>
        mutate((p) => ({
          ...p,
          projects: p.projects.some((x) => x.id === project.id)
            ? p.projects.map((x) => (x.id === project.id ? project : x))
            : [project, ...p.projects],
        })),
      removeProject: (id) =>
        mutate((p) => ({ ...p, projects: p.projects.filter((project) => project.id !== id) })),
      moveProject: (id, direction) =>
        mutate((p) => {
          const currentIndex = p.projects.findIndex((project) => project.id === id);
          const targetIndex = currentIndex + direction;
          if (currentIndex < 0 || targetIndex < 0 || targetIndex >= p.projects.length) return p;
          const projects = [...p.projects];
          [projects[currentIndex], projects[targetIndex]] = [
            projects[targetIndex]!,
            projects[currentIndex]!,
          ];
          return { ...p, projects };
        }),
      setBranding: (patch) => mutate((p) => ({ ...p, branding: { ...p.branding, ...patch } })),
      resetBranding: () => mutate((p) => ({ ...p, branding: defaultBranding })),
      updateContent: (id, patch) =>
        mutate((p) => ({
          ...p,
          content: p.content.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      updateCmsSection: (id, patch) =>
        mutate((p) => ({
          ...p,
          cms: p.cms.map((section) => (section.id === id ? { ...section, ...patch } : section)),
        })),
      updateCmsValue: (id, key, value) =>
        mutate((p) => ({
          ...p,
          cms: p.cms.map((section) =>
            section.id === id
              ? { ...section, values: { ...section.values, [key]: value } }
              : section,
          ),
        })),
      updateLegal: (id, patch) =>
        mutate((p) => ({
          ...p,
          legal: p.legal.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      resetDemo: () => {
        mutate(() => structuredClone(initialState));
      },
    };
  }, [
    state,
    ready,
    authenticated,
    authUser,
    backendAvailable,
    syncError,
    login,
    logout,
    changePassword,
    uploadMedia,
    update,
    mutate,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("A useDemo csak a DemoProvider alatt használható.");
  return ctx;
}

export function useContentBlock(id: string) {
  const { content } = useDemo();
  return content.find((c) => c.id === id);
}

export function useCmsSection(id: string) {
  const { cms } = useDemo();
  const section = cms.find((entry) => entry.id === id);
  return {
    section,
    value: (key: string, fallback = "") => section?.values[key] ?? fallback,
  };
}

const fontStacks: Record<string, string> = {
  Sora: '"Sora", ui-sans-serif, system-ui, sans-serif',
  "Space Grotesk": '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  Manrope: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  Inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
};

export function brandingStyle(b: Branding): React.CSSProperties {
  return {
    ["--primary" as string]: b.primary,
    ["--ink" as string]: b.primary,
    ["--forest" as string]: b.secondary,
    ["--accent" as string]: b.accent,
    ["--background" as string]: b.background,
    ["--font-heading" as string]: fontStacks[b.headingFont] ?? fontStacks["Sora"],
    ["--font-body" as string]: fontStacks[b.bodyFont] ?? fontStacks["Manrope"],
    ["--radius-button" as string]: `${b.buttonRadius}px`,
    ["--radius-card" as string]: `${b.cardRadius}px`,
    ["--shadow-strength" as string]: `${b.shadowStrength}`,
    ["--section-space" as string]: `${b.sectionSpace}`,
    ["--motion-scale" as string]: `${b.motion}`,
  } as React.CSSProperties;
}

export function BrandingScope({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { branding } = useDemo();
  return (
    <div className={className} style={brandingStyle(branding)}>
      {children}
    </div>
  );
}

export const formatHuf = (value: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(value)) + " Ft";

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const nowStamp = () =>
  new Date().toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
