import { createContext, useContext, useEffect } from "react";

// "Kiosk" = the screen is being handed to a customer (field-quote customer
// mode). While it is on, the admin shell hides its menu and header, so the
// customer holding the tablet can't wander into other customers' data.
interface KioskContextValue {
  kiosk: boolean;
  setKiosk: (value: boolean) => void;
}

export const KioskContext = createContext<KioskContextValue>({
  kiosk: false,
  setKiosk: () => {},
});

export const useKiosk = (): boolean => useContext(KioskContext).kiosk;

/** Keeps the admin shell in kiosk mode for as long as `active` is true. */
export function useKioskWhile(active: boolean): void {
  const { setKiosk } = useContext(KioskContext);
  useEffect(() => {
    setKiosk(active);
    return () => setKiosk(false);
  }, [active, setKiosk]);
}
