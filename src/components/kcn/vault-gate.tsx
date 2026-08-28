import { useState } from "react";
import { passphraseScore } from "@/lib/kcn/crypto";
import { createVault, importSealed, migratePlaintext, unlockVault, vaultExists } from "@/lib/kcn/vault";
import { Seal } from "./seal";

type Props = { onOpen: () => void };

export function VaultGate({ onOpen }: Props) {
  const exists = vaultExists();
  const leftover = migratePlaintext();
  const [mode, setMode] = useState<"unlock" | "create" | "import">(exists ? "unlock" : "create");
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const score = passphraseScore(pass);

  async function create() {
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
      await createVault(pass, leftover || undefined);
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
      await unlockVault(pass);
      onOpen();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Vault did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport(file: File) {
    if (!pass) {
      setErr("Enter the backup passphrase first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await importSealed(await file.text(), pass);
      onOpen();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kcn-boot" role="dialog" aria-label="KCN-II operator vault">
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
        <p className="kcn-boot-sub">OPERATOR VAULT • AES-256-GCM</p>
        <p className="kcn-tiny kcn-muted mt-3">
          Investigator files stay on this device, sealed. There is no recovery if the passphrase is lost.
        </p>
        {leftover && mode === "create" ? (
          <p className="kcn-tiny mt-2 text-gold-2">Unsealed files were found. Creating a vault will encrypt and then wipe them.</p>
        ) : null}
        <div className="kcn-vault-form">
          <input
            className="kcn-field"
            type="password"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            placeholder="Vault passphrase"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          {mode === "create" && (
            <input
              className="kcn-field"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm passphrase"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          )}
          {mode === "create" && pass ? <p className="kcn-tiny kcn-muted">{score.label}</p> : null}
          {err ? <p className="kcn-tiny text-gold-2">{err}</p> : null}
          {mode === "unlock" && (
            <button className="kcn-btn gold mt-3 w-full" disabled={busy || !pass} onClick={() => void unlock()}>
              {busy ? "Opening vault…" : "Unlock vault"}
            </button>
          )}
          {mode === "create" && (
            <button className="kcn-btn gold mt-3 w-full" disabled={busy} onClick={() => void create()}>
              {busy ? "Sealing…" : "Create sealed vault"}
            </button>
          )}
          {mode === "import" && (
            <label className="kcn-btn cyan mt-3 w-full">
              Import sealed backup
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
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {exists && (
              <button className="kcn-tiny text-cyan underline" type="button" onClick={() => setMode("unlock")}>
                Unlock
              </button>
            )}
            <button className="kcn-tiny text-cyan underline" type="button" onClick={() => setMode("create")}>
              New vault
            </button>
            <button className="kcn-tiny text-cyan underline" type="button" onClick={() => setMode("import")}>
              Import backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
