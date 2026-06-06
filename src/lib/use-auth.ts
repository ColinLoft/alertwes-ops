import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "dispatcher" | "pilot" | "maintenance";

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  roles: AppRole[];
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    email: null,
    roles: [],
  });

  useEffect(() => {
    let active = true;
    const load = async (uid: string | null, email: string | null) => {
      if (!uid) {
        if (active) setState({ loading: false, userId: null, email: null, roles: [] });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!active) return;
      setState({
        loading: false,
        userId: uid,
        email,
        roles: (data ?? []).map((r) => r.role as AppRole),
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      load(s?.user.id ?? null, s?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user.id ?? null, session?.user.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export const hasRole = (roles: AppRole[], r: AppRole) => roles.includes(r);
export const hasAnyRole = (roles: AppRole[], rs: AppRole[]) => rs.some((r) => roles.includes(r));
