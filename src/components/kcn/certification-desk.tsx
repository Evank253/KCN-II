import { useState } from "react";
import { downloadText } from "@/lib/kcn/legal-copy";
import { certificationText, runCertification, type Certification } from "@/lib/kcn/compliance";
import { IDLE_MS, currentPayload, isUnlocked, recordAudit, sealedBackup, wipeVault } from "@/lib/kcn/vault";

type Props = { onLocked: () => void; onWiped: () => void };

export function CertificationDesk({ onLocked, onWiped }: Props) {
  const [cert, setCert] = useState<Certification | null>(null);
  const [busy, setBusy] = useState(false);
  const [wipe, setWipe] = useState(0);
  const [note, setNote] = useState("");
  const payload = currentPayload();

  async function run() {
    setBusy(true);
    setNote("");
    try {
      const next = await runCertification();
      setCert(next);
      if (isUnlocked()) await recordAudit("CERTIFICATION_RUN");
    } catch {
      setNote("Certification could not finish on this device.");
    } finally {
      setBusy(false);
    }
  }

  function exportVault() {
    try {
      const blob = sealedBackup();
      downloadText("KCN-II-sealed-vault.json", blob);
      void recordAudit("SEALED_BACKUP_EXPORTED").catch(() => undefined);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Export failed.");
    }
  }

  async function confirmWipe() {
    if (wipe < 2) {
      setWipe(wipe + 1);
      return;
    }
    try {
      await wipeVault();
      onWiped();
    } catch {
      setNote("Wipe could not finish on this device.");
      setWipe(0);
    }
  }

  return (
    <section>
      <div className="kcn-legal-stamp">IDPC-1.0 • INVESTIGATOR DATA PROTECTION</div>
      <h2 className="kcn-title">Vault</h2>
      <p className="kcn-hint">
        You do not need certification to work a case. Lock when you step away. Export is ciphertext only.
      </p>
      {note ? <p className="kcn-tiny text-gold-2 mb-3">{note}</p> : null}
      <div className="kcn-legal-grid mb-4">
        <div className="kcn-legal-card on">
          <b>{isUnlocked() ? "VAULT OPEN" : "VAULT SEALED"}</b>
          <span>AES-256-GCM</span>
          <p>Passphrase-derived key. Idle lock {Math.round(IDLE_MS / 60000)} minutes.</p>
        </div>
        <div className={`kcn-legal-card ${cert?.certified ? "on" : ""}`}>
          <b>{cert ? (cert.certified ? "CERTIFIED" : "GAPS FOUND") : "NOT YET RUN"}</b>
          <span>{cert?.score || "IDPC-1.0"}</span>
          <p>{cert?.mode || "Run the live control test to attest this device."}</p>
        </div>
        <div className="kcn-legal-card">
          <b>AUDIT</b>
          <span>{payload?.audit.length || 0} events</span>
          <p>Hash-chained ledger inside the sealed vault.</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="kcn-btn gold" disabled={busy} onClick={() => void run()}>
          {busy ? "Testing controls…" : "Run certification"}
        </button>
        <button className="kcn-btn" onClick={exportVault}>
          Export
        </button>
        {cert && (
          <button className="kcn-btn" onClick={() => downloadText("KCN-II-IDPC-evidence.txt", certificationText(cert))}>
            Download evidence pack
          </button>
        )}
        <button className="kcn-btn" onClick={onLocked}>
          Lock vault
        </button>
        <button className="kcn-btn" onClick={() => void confirmWipe()}>
          {wipe === 0 ? "Wipe this investigator" : wipe === 1 ? "Tap again to confirm wipe" : "Last chance — wipe this investigator now"}
        </button>
      </div>
      {cert && (
        <>
          <p className="kcn-tiny kcn-muted mb-3">{cert.not}</p>
          <div className="flex flex-col gap-2">
            {cert.controls.map((c) => (
              <div key={c.id} className="kcn-item">
                <b>
                  <span className={c.result === "PASS" ? "text-ok" : "text-gold-2"}>{c.result}</span> {c.id} · {c.title}
                </b>
                <div className="kcn-tiny kcn-muted">{c.framework}</div>
                <div className="kcn-tiny mt-1">{c.evidence}</div>
              </div>
            ))}
          </div>
        </>
      )}
      <pre className="kcn-legal-body mt-4">
        {`KCN-II does not send case files to a server unless you run a lookup and
explicitly allow the photo to leave this device.

Local filing, notes, people, locations, findings, and evidence stay in the
sealed vault. Lookups use HTTPS. Canvas capture strips camera metadata.

This program maps to NIST CSF 2.0 and ISO 27001:2022 control language for
evidence. It does not replace a licensed auditor, CJIS package, or ATO.`}
      </pre>
    </section>
  );
}
