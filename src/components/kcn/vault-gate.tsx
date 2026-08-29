import { useEffect, useState } from "react";
import { passphraseScore } from "@/lib/kcn/crypto";
import { readAutoSecret, vaultKey } from "@/lib/kcn/accounts";
import { pullAccountVault } from "@/lib/kcn/cloud-vault";
import { createVault, importSealed, openAccountSession, unlockVault, vaultExistsFor, wipeVault } from "@/lib/kcn/vault";
import { Seal } from "./seal";

type Props = {
  onOpen: () => void;
  userId: string;
  operatorName: string;
  email: string;
};
type Mode = "unlock" | "create" | "import";

export function VaultGate({ onOpen, userId, operatorName, email }: Props) {
  const [mode, setMode] = useState<Mode>("create");
  const [ready, setReady] = useState(false);
  const [name, setName] = useState(operatorName || "");
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const score = passphraseScore(pass);

  useEffect(() => {
    let live = true;
    setReady(false);
    setName(operatorName || email.split("@")[0] || "Investigator");
    void (async () => {
      if (userId !== "guest") await pullAccountVault(userId);
      if (!live) return;
      const auto = readAutoSecret(userId);
      if (auto) {
        try {
          await unlockVault(auto, userId);
          if (!live) return;
          onOpen();
          return;
        } catch {
          /* fall through to passphrase */
        }
      }
      const exists = vaultExistsFor(userId);
      setMode(exists ? "unlock" : "create");
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [userId, operatorName, email]);

  async function create() {
    if (!name.trim()) {
      setErr("Type the investigator name.");
      return;
    }
    if (!score.ok) {
      setErr(score.label);
      return;
    }
    if (pass !== again) {
      setErr("Passphrases do not match.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await createVault(pass, undefined, name.trim(), userId);
      onOpen();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not seal the vault.");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setBusy(true);
    setErr("");
    try {
      await unlockVault(pass, userId);
      onOpen();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wrong passphrase, or that vault did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport(file: File) {
    if (!pass) {
      setErr("Type the backup passphrase first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await importSealed(await file.text(), pass, name.trim() || operatorName, userId);
      onOpen();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed. Use a sealed backup, not a plain file.");
    } finally {
      setBusy(false);
    }
  }

  async function startEasy() {
    setBusy(true);
    setErr("");
    try {
      if (mode === "unlock" || vaultExistsFor(userId)) await wipeVault(userId);
      const r = await openAccountSession(userId, name.trim() || operatorName);
      if (r === "opened") onOpen();
      else setErr("Could not open a workspace. Try a passphrase vault instead.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open a workspace.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (busy) return;
    if (mode === "unlock") void unlock();
    else if (mode === "create") void create();
  }

  const title = mode === "unlock" ? "UNLOCK YOUR VAULT" : mode === "import" ? "RESTORE BACKUP" : "SEAL THIS ACCOUNT";

  if (!ready) {
    return (
      <div className="kcn-boot kcn-vault-gate" role="dialog" aria-label="Loading vault">
        <div className="kcn-boot-scan" />
        <div className="kcn-boot-stage">
          <p className="kcn-boot-sub">LOADING ACCOUNT VAULT</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kcn-boot kcn-vault-gate" role="dialog" aria-label="KCN-II operator vault">
      <div className="kcn-boot-scan" />
      <div className="kcn-boot-grid" />
      <div className="kcn-boot-stage">
        <div className="kcn-boot-3d">
          <div className="kcn-boot-ring r1" />
          <div className="kcn-boot-seal">
            <Seal prefix="vault" className="h-full w-full" />
          </div>
        </div>
        <h1 className="kcn-boot-title">
          KCN-<span>II</span>
        </h1>
        <p className="kcn-boot-sub">{title}</p>
        <p className="kcn-hint mt-3">
          Optional extra lock for this account. Most operators can skip this and keep working.
        </p>
        <div className="kcn-vault-form">
          {mode === "unlock" ? (
            <p className="kcn-tiny text-gold-2">
              Vault passphrase for this account. It is not your sign-in password.
            </p>
          ) : null}
          {mode !== "unlock" && (
            <input
              className="kcn-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Investigator name"
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          )}
          <div className="kcn-pass-row">
            <input
              className="kcn-field"
              type={show ? "text" : "password"}
              autoFocus
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              placeholder={
                mode === "unlock"
                  ? "Vault passphrase for this account"
                  : "Vault passphrase — 12 or more characters"
              }
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button className="kcn-tiny text-cyan" type="button" onClick={() => setShow((s) => !s)}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {mode === "create" && (
            <input
              className="kcn-field"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Type it again"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          )}
          {mode === "create" && pass ? <p className="kcn-tiny kcn-muted">{score.label}</p> : null}
          {mode === "create" ? (
            <p className="kcn-tiny kcn-muted">
              Sign-in password gets you into the account. This passphrase encrypts the case. There is no recovery.
            </p>
          ) : null}
          {err ? <p className="kcn-tiny text-gold-2">{err}</p> : null}
          {mode !== "unlock" ? (
            <button className="kcn-btn gold mt-3 w-full" type="button" disabled={busy} onClick={() => void startEasy()}>
              {busy ? "Opening…" : "Continue without a vault passphrase"}
            </button>
          ) : null}
          {mode === "unlock" && (
            <button className="kcn-btn gold mt-3 w-full" disabled={busy || !pass} onClick={() => void unlock()}>
              {busy ? "Opening…" : "Open vault"}
            </button>
          )}
          {mode === "create" && (
            <button className="kcn-btn mt-3 w-full" disabled={busy} onClick={() => void create()}>
              {busy ? "Sealing…" : "Create a passphrase vault instead"}
            </button>
          )}
          {mode === "import" && (
            <label className="kcn-btn cyan mt-3 w-full">
              Choose sealed backup
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImport(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {vaultExistsFor(userId) || localStorage.getItem(vaultKey(userId)) ? (
              <button
                className="kcn-tiny text-cyan underline"
                type="button"
                onClick={() => {
                  setMode("unlock");
                  setErr("");
                  setPass("");
                }}
              >
                Unlock existing vault
              </button>
            ) : null}
            <button
              className="kcn-tiny text-cyan underline"
              type="button"
              onClick={() => {
                setMode("import");
                setErr("");
              }}
            >
              Restore backup into this account
            </button>
            {mode === "unlock" ? (
              <button
                className="kcn-tiny text-gold-2 underline"
                type="button"
                disabled={busy}
                onClick={() => void startEasy()}
              >
                Start a new empty workspace (erases this vault)
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
