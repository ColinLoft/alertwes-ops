import { useEffect } from "react";
import { useSettings } from "./settings";

/**
 * Apply user-chosen brand colors to CSS custom properties on <html>.
 * Tailwind utilities (bg-primary etc.) read from these vars, so this
 * recolors the whole UI instantly and persists via localStorage.
 */
export function useApplyBranding() {
  const [s] = useSettings();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (s.primaryColor) {
      root.style.setProperty("--primary", s.primaryColor);
      root.style.setProperty("--ring", s.primaryColor);
      root.style.setProperty("--sidebar-primary", s.primaryColor);
      root.style.setProperty("--sidebar-ring", s.primaryColor);
    }
    if (s.accentColor) {
      root.style.setProperty("--accent", s.accentColor);
    }
  }, [s.primaryColor, s.accentColor]);
}
