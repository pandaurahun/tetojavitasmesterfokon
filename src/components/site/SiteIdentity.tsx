import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useDemo } from "@/demo/store";

const DYNAMIC_FAVICON_SELECTOR = 'link[data-site-favicon="dynamic"]';
const CANONICAL_SELECTOR = 'link[data-site-canonical="dynamic"]';
const SITE_ORIGIN = "https://tetojavitasmesterfokon.hu";

function faviconType(url: string): string | undefined {
  if (url.startsWith("data:image/svg+xml") || /\.svg(?:$|[?#])/i.test(url)) {
    return "image/svg+xml";
  }
  if (url.startsWith("data:image/png") || /\.png(?:$|[?#])/i.test(url)) {
    return "image/png";
  }
  if (
    url.startsWith("data:image/x-icon") ||
    url.startsWith("data:image/vnd.microsoft.icon") ||
    /\.ico(?:$|[?#])/i.test(url)
  ) {
    return "image/x-icon";
  }
  return undefined;
}

export function SiteIdentity() {
  const { branding } = useDemo();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const href = branding.faviconUrl.trim() || "/favicon.svg";
    let link = document.head.querySelector<HTMLLinkElement>(DYNAMIC_FAVICON_SELECTOR);

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.dataset["siteFavicon"] = "dynamic";
      document.head.appendChild(link);
    }

    link.href = href;
    const type = faviconType(href);
    if (type) link.type = type;
    else link.removeAttribute("type");
  }, [branding.faviconUrl]);

  useEffect(() => {
    let link = document.head.querySelector<HTMLLinkElement>(CANONICAL_SELECTOR);
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      link.dataset["siteCanonical"] = "dynamic";
      document.head.appendChild(link);
    }
    // No query string on purpose — UTM/gclid/fbclid variants of a page must
    // all canonicalize to the same clean URL.
    link.href = SITE_ORIGIN + pathname;
  }, [pathname]);

  return null;
}
