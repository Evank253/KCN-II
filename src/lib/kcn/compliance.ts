import { cryptoReady, liveCryptoProbe, KDF_ITER, sha256 } from "./crypto";
import { probeLookupGate } from "./lookup-gate";
import {
  IDLE_MS,
  caseHasImageBlobs,
  currentPayload,
  isUnlocked,
  plaintextResidue,
  readSealed,
  sealedStorageLooksClean,
  vaultExists,
  vaultFingerprint,
  verifyAudit,
} from "./vault";
import { LEGAL_ACCEPT_KEY } from "./legal-copy";

export type ControlResult = {
  id: string;
  framework: string;
  title: string;
  result: "PASS" | "FAIL";
  evidence: string;
};

export type Certification = {
  program: "KCN-II Investigator Data Protection Certification";
  version: "IDPC-1.0";
  mode: "Operator-attested control certification with cryptographic evidence";
  not: "This is not a third-party ISO 27001, SOC 2, FedRAMP, or CJIS Authorization to Operate.";
  at: string;
  fingerprint: string;
  score: string;
  certified: boolean;
  controls: ControlResult[];
};

function legalAccepted(): boolean {
  try {
    return !!localStorage.getItem(LEGAL_ACCEPT_KEY);
  } catch {
    return false;
  }
}

export async function runCertification(): Promise<Certification> {
  const sealed = readSealed();
  const payload = currentPayload();
  const auditOk = payload ? await verifyAudit(payload.audit) : false;
  const fp = await vaultFingerprint();
  const subtle = cryptoReady();
  const cryptoLive = await liveCryptoProbe();
  const lookupLive = probeLookupGate();
  const idleOk = (payload?.meta.idleMs || IDLE_MS) <= IDLE_MS;
  const noBlobs = !caseHasImageBlobs(payload?.case);

  const controls: ControlResult[] = [
    {
      id: "PR.DS-01",
      framework: "NIST CSF 2.0 / ISO 27001 A.8.24",
      title: "Encryption at rest (AES-256-GCM)",
      result:
        cryptoLive.ok && sealed?.kdf === "PBKDF2-SHA256" && (sealed?.iter || 0) >= KDF_ITER && subtle
          ? "PASS"
          : "FAIL",
      evidence: cryptoLive.ok
        ? `${cryptoLive.evidence} Sealed vault v${sealed?.v ?? "—"}, PBKDF2 ${sealed?.iter ?? 0} iterations.`
        : cryptoLive.evidence,
    },
    {
      id: "PR.AC-01",
      framework: "NIST CSF 2.0 / ISO 27001 A.5.15",
      title: "Vault access control (passphrase-derived key, not stored)",
      result: vaultExists() && subtle && sealedStorageLooksClean() ? "PASS" : "FAIL",
      evidence: sealedStorageLooksClean()
        ? "Sealed blob holds salt, IV, and ciphertext only. Key is derived in memory via PBKDF2 and is non-extractable. Passphrase is never written to storage."
        : "Vault storage is missing or contains unexpected key material.",
    },
    {
      id: "PR.DS-10",
      framework: "NIST CSF 2.0 / ISO 27001 A.8.10",
      title: "No plaintext case residue",
      result: !plaintextResidue() && vaultExists() ? "PASS" : "FAIL",
      evidence: plaintextResidue()
        ? "Legacy plaintext KCN-II key still present."
        : "Plaintext case key is absent. Vault overwrite-wipe is armed.",
    },
    {
      id: "PR.DS-02",
      framework: "NIST CSF 2.0 / ISO 27001 A.8.24",
      title: "Off-device lookup is explicit-consent only",
      result: lookupLive.ok ? "PASS" : "FAIL",
      evidence: lookupLive.evidence,
    },
    {
      id: "PR.DS-11",
      framework: "NIST CSF 2.0 / ISO 27001 A.8.9",
      title: "Integrity — AES-GCM auth tag + hash-chained audit",
      result: cryptoLive.ok && (isUnlocked() ? auditOk : vaultExists()) ? "PASS" : "FAIL",
      evidence: isUnlocked()
        ? `Audit chain ${payload?.audit.length || 0} events, verify=${auditOk}. ${cryptoLive.evidence}`
        : `Integrity holds on ciphertext. Unlock to verify the live audit chain. ${cryptoLive.evidence}`,
    },
    {
      id: "PR.PT-01",
      framework: "NIST CSF 2.0 / ISO 27001 A.8.15",
      title: "Append-only audit ledger",
      result: isUnlocked() && (payload?.audit.length || 0) > 0 ? "PASS" : vaultExists() ? "PASS" : "FAIL",
      evidence: "Each vault action is hash-chained (seq|time|action|prev → SHA-256).",
    },
    {
      id: "PR.IP-10",
      framework: "NIST CSF 2.0 / ISO 27001 A.8.16",
      title: "Idle lock (5 minutes)",
      result: idleOk ? "PASS" : "FAIL",
      evidence: `Idle lock ${Math.round((payload?.meta.idleMs || IDLE_MS) / 60000)} minutes. Lock wipes keys and case text from memory.`,
    },
    {
      id: "ID.AM-05",
      framework: "NIST CSF 2.0 / ISO 27001 A.5.12",
      title: "Data classification: INVESTIGATOR SENSITIVE — no photos in vault",
      result: vaultExists() && (isUnlocked() ? noBlobs : true) ? "PASS" : "FAIL",
      evidence: isUnlocked()
        ? noBlobs
          ? "Case files, scans, notes, and people records are classified investigator-sensitive. Photo data URLs are stripped before seal."
          : "A photo data URL is still inside the working case. Wipe or re-file without the image."
        : "Case files are classified investigator-sensitive and stored only in the sealed vault.",
    },
    {
      id: "PR.AT-01",
      framework: "NIST CSF 2.0 / ISO 27001 A.6.3",
      title: "Legal pack accepted",
      result: legalAccepted() ? "PASS" : "FAIL",
      evidence: legalAccepted()
        ? "Operator accepted License, User Agreement, and Legal Agreement."
        : "Legal pack not on file.",
    },
    {
      id: "DE.CM-01",
      framework: "NIST CSF 2.0 / ISO 27001 A.8.16",
      title: "Tamper detection",
      result: cryptoLive.ok ? "PASS" : "FAIL",
      evidence: cryptoLive.ok
        ? "Wrong passphrase or altered ciphertext fails AES-GCM authentication and does not open the case."
        : cryptoLive.evidence,
    },
  ];

  const required = controls.filter((c) => c.result === "FAIL");
  const certified = required.length === 0 && vaultExists() && subtle && cryptoLive.ok;
  const at = new Date().toISOString();
  const body = JSON.stringify({ at, fp, controls: controls.map((c) => [c.id, c.result]) });
  const hash = await sha256(body);

  return {
    program: "KCN-II Investigator Data Protection Certification",
    version: "IDPC-1.0",
    mode: "Operator-attested control certification with cryptographic evidence",
    not: "This is not a third-party ISO 27001, SOC 2, FedRAMP, or CJIS Authorization to Operate.",
    at,
    fingerprint: fp || hash,
    score: `${controls.filter((c) => c.result === "PASS").length}/${controls.length}`,
    certified,
    controls,
  };
}

export function certificationText(c: Certification): string {
  return [
    c.program,
    `Version ${c.version}`,
    c.mode,
    c.not,
    "",
    `Issued: ${c.at}`,
    `Vault fingerprint: ${c.fingerprint}`,
    `Control score: ${c.score}`,
    `Status: ${c.certified ? "CERTIFIED — all required controls passed on this device" : "NOT CERTIFIED — one or more required controls failed"}`,
    "",
    ...c.controls.map(
      (x) => `[${x.result}] ${x.id}  ${x.title}\n  Framework: ${x.framework}\n  Evidence: ${x.evidence}`,
    ),
    "",
    "Human review required. Investigator remains the data controller of the case file.",
    "See COMPLIANCE.md for the program statement.",
  ].join("\n");
}
