"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/ui/BrandMark";

type AuthMode = "sign-in" | "sign-up";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setBusy(true);
    setMessage("");
    setIsSuccess(false);

    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "sign-up" && !result.data.session) {
      setIsSuccess(true);
      setConfirmationEmail(email);
      setMessage(
        "Confirmation requested. Check your inbox and spam folder, then confirm your account.",
      );
    } else {
      router.refresh();
    }

    setBusy(false);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
    setIsSuccess(false);
    setConfirmationEmail("");
  };

  const resendConfirmation = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !confirmationEmail) return;

    setResendBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setIsSuccess(!error);
    setMessage(
      error
        ? error.message
        : "Confirmation requested again. Delivery can take a few minutes.",
    );
    setResendBusy(false);
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <BrandMark size="large" />

        <div className="auth-copy">
          <p className="eyebrow">Your complete portfolio</p>
          <h1>Know where you stand. Every month.</h1>
          <p>
            Bring accounts, holdings and net worth into one calm personal portfolio
            designed for regular updates—not financial noise.
          </p>
          <div className="trust-row">
            <span><LockKeyhole size={15} /> Private by default</span>
            <span><ShieldCheck size={15} /> Portfolio protected</span>
          </div>
        </div>

        <div className="mini-dashboard" aria-hidden="true">
          <div>
            <span>Total assets</span>
            <strong className="placeholder" />
          </div>
          <div>
            <span>Liabilities</span>
            <strong className="placeholder" />
          </div>
          <div>
            <span>Net worth</span>
            <strong>Ready when you are</strong>
          </div>
        </div>
      </section>

      <section className="auth-side">
        <div className="auth-card">
          <p className="eyebrow">Secure access</p>
          <h2>{mode === "sign-in" ? "Welcome back" : "Create your portfolio"}</h2>
          <p className="auth-intro">
            {mode === "sign-in"
              ? "Sign in to continue to your tracker."
              : "Start clean. We will not add any sample accounts or amounts."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button
              className={mode === "sign-in" ? "active" : ""}
              onClick={() => switchMode("sign-in")}
              role="tab"
              aria-selected={mode === "sign-in"}
              type="button"
            >
              Sign in
            </button>
            <button
              className={mode === "sign-up" ? "active" : ""}
              onClick={() => switchMode("sign-up")}
              role="tab"
              aria-selected={mode === "sign-up"}
              type="button"
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                minLength={6}
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <button className="primary-button" disabled={busy} type="submit">
              {busy && <LoaderCircle size={17} className="spin" />}
              {busy
                ? "Please wait…"
                : mode === "sign-in"
                  ? "Sign in securely"
                  : "Create private portfolio"}
            </button>
          </form>

          {message && (
            <p className={`auth-message ${isSuccess ? "success" : ""}`} role="status">
              <AlertCircle size={16} />
              {message}
            </p>
          )}
          {isSuccess && confirmationEmail && (
            <button
              className="resend-button"
              disabled={resendBusy}
              onClick={resendConfirmation}
              type="button"
            >
              {resendBusy ? "Requesting…" : "Resend confirmation email"}
            </button>
          )}

          <p className="auth-fineprint">
            Your financial data is separated by account and protected by
            database-level access rules.
          </p>
        </div>
      </section>
    </main>
  );
}
