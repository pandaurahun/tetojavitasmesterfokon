import { useMemo, useState, type ReactNode } from "react";
import { KioskContext } from "@/components/admin/kiosk-context";

export function KioskProvider({ children }: { children: ReactNode }) {
  const [kiosk, setKiosk] = useState(false);
  const value = useMemo(() => ({ kiosk, setKiosk }), [kiosk]);
  return <KioskContext.Provider value={value}>{children}</KioskContext.Provider>;
}
