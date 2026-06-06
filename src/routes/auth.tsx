import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ALERTWest" },
      { name: "description", content: "Sign in to sync your ALERTWest branding and settings across devices." },
    ],
  }),
  component: AuthPage,
  ssr: false,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/settings" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setNotice("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/settings" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (!result.redirected) navigate({ to: "/settings" });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-card/40 p-6 backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          <div className="text-sm font-bold tracking-wide">
            ALERT<span className="text-primary">West</span>
          </div>
        </div>
        <h1 className="text-lg font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Sync your logo, brand colors, and preferences across devices.
        </p>

        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {error && <div className="text-xs text-destructive">{error}</div>}
          {notice && <div className="text-xs text-primary">{notice}</div>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? Create one" : "Have an account? Sign in"}
        </button>

        <div className="mt-4 text-center">
          <Link to="/" className="text-[11px] text-muted-foreground hover:text-foreground">
            Back to map
          </Link>
        </div>
      </div>
    </div>
  );
}
