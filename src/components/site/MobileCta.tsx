import { Link } from "@tanstack/react-router";
import { Phone, PhoneCall, FileText } from "lucide-react";
import { useCmsSection, useDemo } from "@/demo/store";
import { useCallbackModal } from "@/demo/ui";

export function MobileCta() {
  const { settings } = useDemo();
  const { section, value } = useCmsSection("global.mobileCta");
  const { open } = useCallbackModal();

  if (section?.visible === false) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-70 border-t border-border bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] backdrop-blur-xl sm:hidden print:hidden">
      <div className="grid grid-cols-3 divide-x divide-border">
        <a
          href={`tel:${settings.phone.replace(/\s/g, "")}`}
          className="flex flex-col items-center gap-1 py-3 text-xs font-medium"
        >
          <Phone className="h-4 w-4 text-accent" />
          {value("call", "Hívás")}
        </a>
        <button
          onClick={() => open()}
          className="flex flex-col items-center gap-1 py-3 text-xs font-medium"
        >
          <PhoneCall className="h-4 w-4 text-accent" />
          {value("callback", "Visszahívás")}
        </button>
        <Link
          to="/ajanlatkeres"
          className="flex flex-col items-center gap-1 bg-accent py-3 text-xs font-semibold text-accent-foreground"
        >
          <FileText className="h-4 w-4" />
          {value("quote", "Ajánlatkérés")}
        </Link>
      </div>
    </div>
  );
}
