import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Clock, ShieldAlert, LogOut, KeySquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

type Status = "loading" | "no_user" | "pending" | "approved" | "denied";

export function ApprovalGate({ children }: { children: ReactNode }) {
  const { userId, loading: authLoading, email } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!userId) {
      setStatus("no_user");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      const s = (data?.status as Status | undefined) ?? "pending";
      setStatus(s === "approved" || s === "denied" || s === "pending" ? s : "pending");
    })();
    // realtime updates
    const ch = supabase
      .channel(`profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `user_id=eq.${userId}` },
        (payload) => {
          const ns = (payload.new as any)?.status;
          if (ns) setStatus(ns);
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [userId, authLoading]);

  if (authLoading || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (status === "no_user") {
    return <UnauthedScreen />;
  }
  if (status === "pending") {
    return (
      <CenterCard
        icon={<Clock className="h-8 w-8 text-amber-400" />}
        title="Awaiting approval"
        body={`Your account (${email}) is registered but not yet authorized for Aegis Command. An administrator will grant access shortly.`}
        footer={
          <div className="flex flex-col gap-2 items-center">
            <button
              disabled={claiming}
              onClick={async () => {
                setClaiming(true);
                const { error } = await supabase.rpc("claim_first_admin");
                setClaiming(false);
                if (error) toast.error(error.message);
                else {
                  toast.success("You are now admin");
                  setStatus("approved");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25"
            >
              <KeySquare className="h-3.5 w-3.5" /> {claiming ? "Claiming…" : "Claim first admin"}
            </button>
            <span className="text-[10px] text-muted-foreground">
              Only works if no admin exists yet.
            </span>
            <SignOutBtn />
          </div>
        }
      />
    );
  }
  if (status === "denied") {
    return (
      <CenterCard
        icon={<ShieldAlert className="h-8 w-8 text-rose-400" />}
        title="Access denied"
        body="Your account is not authorized for Aegis Command."
        footer={<SignOutBtn />}
      />
    );
  }
  return <>{children}</>;
}

function CenterCard({
  icon,
  title,
  body,
  footer,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-6">
      <div className="glass-strong rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">{icon}</div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        {footer}
      </div>
    </div>
  );
}

function SignOutBtn() {
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 mt-2"
    >
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </button>
  );
}

function UnauthedScreen() {
  return (
    <CenterCard
      icon={<ShieldCheck className="h-8 w-8 text-primary" />}
      title="Sign in required"
      body="Aegis Command is restricted to authorized operators. Please sign in to continue."
      footer={
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:brightness-110"
        >
          Sign in
        </Link>
      }
    />
  );
}
