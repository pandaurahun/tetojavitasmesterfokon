import { useEffect } from "react";
import { useDemo } from "@/demo/store";

const DYNAMIC_FAVICON_SELECTOR = 'link[data-site-favicon="dynamic"]';

function faviconType(url: string): string | undefined {
  if (url.startsWith("data:image/svg+xml") || /\.svg(?:$|[?#])/i.test(url)) {
    return "image/svg+xml";
  }
  if (url.startsWith("data:image/png") || /\.png(?:$|[?#])/i.test(url)) {
    return "image/png";
  }
  if (
    url.startsWith("data:image/(?:x-icon|vnd\.microsoft\.icon)") ||
    /\.ico(?:$|[?#])/i.test(url)
  ) {
    return "image/x-icon";
  }
  return undefined;
}

export function SiteIdentity() {
  const { branding } = useDemo();

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

  return null;
}
