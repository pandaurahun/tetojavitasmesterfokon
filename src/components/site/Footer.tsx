import { Link } from "@tanstack/react-router";
import {
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  MessageCircle,
  Music2,
} from "lucide-react";
import type { SocialLinks, SocialPlatform } from "@/demo/types";
import { useCmsSection, useDemo } from "@/demo/store";
import { demoUiEnabled } from "@/lib/features";
import { trackPhoneClick } from "@/lib/analytics";
import { useConsentSettings } from "./ConsentBanner";
import { Mark } from "./Header";

export function Footer() {
  const { settings, services, branding } = useDemo();
  const { section, value } = useCmsSection("global.footer");
  const { open: openConsentSettings } = useConsentSettings();

  if (section && !section.visible) return null;

  return (
    <footer className="bg-ink text-ink-foreground print:hidden">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-lg font-semibold">{branding.logoText}</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-[color-mix(in_oklab,var(--ink-foreground)_72%,transparent)]">
            {value("description")}
          </p>
          <p className="mt-6 text-xs text-[color-mix(in_oklab,var(--ink-foreground)_50%,transparent)]">
            {value("note")}
          </p>
        </div>

        <FooterCol title={value("servicesTitle", "Szolgáltatások")}>
          {services
            .filter((s) => s.active)
            .slice(0, 6)
            .map((s) => (
              <Link key={s.id} to="/szolgaltatasok" className="block hover:text-accent">
                {s.title}
              </Link>
            ))}
        </FooterCol>

        <FooterCol title={value("pagesTitle", "Oldalak")}>
          <Link to="/referenciak" className="block hover:text-accent">
            Referenciák
          </Link>
          <Link to="/folyamat" className="block hover:text-accent">
            Folyamat
          </Link>
          <Link to="/tudastar" className="block hover:text-accent">
            Tudástár
          </Link>
          <Link to="/ajanlatkeres" className="block hover:text-accent">
            Ajánlatkérés
          </Link>
          <Link to="/kapcsolat" className="block hover:text-accent">
            Kapcsolat
          </Link>
          {demoUiEnabled ? (
            <Link to="/admin" className="block hover:text-accent">
              Demó adminfelület
            </Link>
          ) : null}
        </FooterCol>

        <FooterCol title={value("contactTitle", "Elérhetőség")}>
          <a
            href={`tel:${settings.phone.replace(/\s/g, "")}`}
            onClick={() => trackPhoneClick()}
            className="flex items-center gap-2 hover:text-accent"
          >
            <Phone className="h-3.5 w-3.5" /> {settings.phone}
          </a>
          <a
            href={`mailto:${settings.email}`}
            className="flex items-center gap-2 hover:text-accent"
          >
            <Mail className="h-3.5 w-3.5" /> {settings.email}
          </a>
          <span className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {settings.address}
          </span>
          <span className="block pt-2 text-xs opacity-70">{settings.workingHours}</span>
          <SocialLinksRow links={settings.socialLinks} />
        </FooterCol>
      </div>

      <div className="border-t border-[color-mix(in_oklab,white_10%,transparent)]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-xs text-[color-mix(in_oklab,var(--ink-foreground)_60%,transparent)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © {new Date().getFullYear()} {branding.logoText} — {value("copyrightSuffix")}
          </span>
          <div className="flex flex-wrap gap-4">
            <Link to="/jogi/$slug" params={{ slug: "impresszum" }} className="hover:text-accent">
              Impresszum
            </Link>
            <Link
              to="/jogi/$slug"
              params={{ slug: "adatkezelesi-tajekoztato" }}
              className="hover:text-accent"
            >
              Adatkezelés
            </Link>
            <Link to="/jogi/$slug" params={{ slug: "aszf" }} className="hover:text-accent">
              ÁSZF
            </Link>
            <Link
              to="/jogi/$slug"
              params={{ slug: "cookie-tajekoztato" }}
              className="hover:text-accent"
            >
              Cookie
            </Link>
            <button type="button" onClick={openConsentSettings} className="hover:text-accent">
              Süti beállítások
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

const SOCIAL_ICONS: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  messenger: MessageCircle,
  tiktok: Music2,
  youtube: Youtube,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
};

function SocialLinksRow({ links }: { links: SocialLinks | undefined }) {
  const entries = Object.entries(links ?? {}).filter(([, href]) => href) as [SocialPlatform, string][];
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {entries.map(([platform, href]) => {
        const Icon = SOCIAL_ICONS[platform];
        return (
          <a
            key={platform}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={platform}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_oklab,white_16%,transparent)] hover:border-accent hover:text-accent"
          >
            <Icon className="h-3.5 w-3.5" />
          </a>
        );
      })}
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="label-eyebrow text-accent">{title}</h3>
      <div className="mt-4 space-y-2.5 text-sm text-[color-mix(in_oklab,var(--ink-foreground)_78%,transparent)]">
        {children}
      </div>
    </div>
  );
}
