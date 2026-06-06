import { useEffect, useRef, useState } from "react";
import { useSettings, type Settings } from "./settings";
import { supabase } from "@/integrations/supabase/client";

/**
 * Apply user-chosen brand colors to CSS custom properties on <html>.
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

const BRAND_KEYS = ["brandName", "logoDataUrl", "primaryColor", "accentColor"] as const;

function brandSignature(s: Settings) {
  return JSON.stringify({
    brandName: s.brandName,
    logoDataUrl: s.logoDataUrl,
    primaryColor: s.primaryColor,
    accentColor: s.accentColor,
  });
}

/**
 * Two-way sync the branding fields with the signed-in user's row in
 * `user_branding`. When a user signs in, their stored branding is pulled
 * and merged into local settings (so it follows them between devices).
 * When branding changes locally, it's pushed back to the DB.
 */
export function useBrandingSync() {
  const [settings, setSettings] = useSettings();
  const [userId, setUserId] = useState<string | null>(null);
  const lastRemoteSig = useRef<string | null>(null);
  const hydrated = useRef(false);

  // Track auth state.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      if (!session) {
        hydrated.current = false;
        lastRemoteSig.current = null;
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Pull branding when user changes.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_branding")
        .select("brand_name, logo_data_url, primary_color, accent_color")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || error || !data) {
        hydrated.current = true;
        return;
      }
      setSettings((p) => {
        const next: Settings = {
          ...p,
          brandName: data.brand_name ?? p.brandName,
          logoDataUrl: data.logo_data_url ?? p.logoDataUrl,
          primaryColor: data.primary_color ?? p.primaryColor,
          accentColor: data.accent_color ?? p.accentColor,
        };
        lastRemoteSig.current = brandSignature(next);
        return next;
      });
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, setSettings]);

  // Push branding when it changes locally.
  useEffect(() => {
    if (!userId || !hydrated.current) return;
    const sig = brandSignature(settings);
    if (sig === lastRemoteSig.current) return;
    lastRemoteSig.current = sig;
    const t = setTimeout(() => {
      supabase
        .from("user_branding")
        .upsert(
          {
            user_id: userId,
            brand_name: settings.brandName,
            logo_data_url: settings.logoDataUrl,
            primary_color: settings.primaryColor,
            accent_color: settings.accentColor,
          },
          { onConflict: "user_id" },
        )
        .then(({ error }) => {
          if (error) console.warn("branding sync failed", error.message);
        });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ...BRAND_KEYS.map((k) => settings[k])]);
}
