import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Seal } from "@/components/kcn/seal";
import { Starfield } from "@/components/kcn/starfield";

export const Route = createFileRoute("/login")({ component: Login });

function stashPreviewToken(data: unknown) {
  try {
    const token = (data as { token?: string } | null)?.token;
    if (token) window.sessionStorage.setItem("grok-auth.bearer-token", token);
  } catch {
    /* private mode */
  }
}

function Login() {
  const { user } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  if (user) return <Navigate to="/" />;

  async function submit() {
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) {
      setErr("Type a valid email.");
      return;
    }
    if (pass.length < 8) {
      setErr("Account password needs 8 or more characters.");
      return;
    }
    if (mode === "up") {
      if (!name.trim()) {
        setErr("Type your investigator name.");
        return;
      }
      if (pass !== again) {
        setErr("Passwords do not match.");
        return;
      }
    }
    if (!authEnabled) {
      setErr("Sign-in is disabled.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      if (mode === "up") {
        const { data, error } = await authClient.signUp.email({
          email: em,
          password: pass,
          name: name.trim().slice(0, 48),
        });
        if (error) throw new Error(error.message || "Could not create the account.");
        stashPreviewToken(data);
      } else {
        const { data, error } = await authClient.signIn.email({
          email: em,
          password: pass,
        });
        if (error) throw new Error(error.message || "Email or password did not match.");
        stashPreviewToken(data);
      }
      try {
        await authClient.getSession();
      } catch {
        /* session store will recover */
      }
      window.location.assign("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="kcn-boot kcn-login" role="dialog" aria-label="KCN-II sign in">
      <Starfield />
      <div className="kcn-boot-scan" />
      <div className="kcn-boot-grid" />
      <div className="kcn-boot-stage">
        <div className="kcn-boot-3d">
          <div className="kcn-boot-ring r1" />
          <div className="kcn-boot-seal">
            <Seal prefix="login" className="h-full w-full" />
          </div>
        </div>
        <h1 className="kcn-boot-title">
          KCN-<span>II</span>
        </h1>
        <p className="kcn-boot-sub">{mode === "up" ? "CREATE ACCOUNT" : "OPERATOR SIGN-IN"}</p>
        <p className="kcn-hint mt-3">
          Sign in is optional. Search, scan, and desks work without an account. Use email only if you want this case on its own login.
        </p>
        {authEnabled ? (
          <form
            className="kcn-vault-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {mode === "up" ? (
              <input
                className="kcn-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Investigator name"
                autoComplete="name"
              />
            ) : null}
            <input
              className="kcn-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              autoFocus
            />
            <div className="kcn-pass-row">
              <input
                className="kcn-field"
                type={show ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Account password — 8 or more characters"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
              />
              <button className="kcn-tiny text-cyan" type="button" onClick={() => setShow((s) => !s)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "up" ? (
              <input
                className="kcn-field"
                type={show ? "text" : "password"}
                value={again}
                onChange={(e) => setAgain(e.target.value)}
                placeholder="Type it again"
                autoComplete="new-password"
              />
            ) : null}
            {err ? <p className="kcn-tiny text-gold-2">{err}</p> : null}
            <button className="kcn-btn gold mt-3 w-full" type="submit" disabled={busy}>
              {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"}
            </button>
            <button
              className="kcn-tiny mt-3 text-cyan underline"
              type="button"
              onClick={() => {
                setMode(mode === "up" ? "in" : "up");
                setErr("");
              }}
            >
              {mode === "up" ? "Already have an account? Sign in" : "New investigator? Create an account"}
            </button>
            <a className="kcn-btn mt-3 w-full" href="/">
              Continue without an account
            </a>
          </form>
        ) : (
          <p className="kcn-hint">Sign-in is disabled.</p>
        )}
      </div>
    </div>
  );
}
