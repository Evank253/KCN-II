import type { KcnState } from "./store";
import {
  KDF_ITER,
  b64,
  bytes,
  cryptoReady,
  decryptJson,
  deriveKey,
  encryptJson,
  overwriteWipe,
  sha256,
  unb64,
} from "./crypto";

export const VAULT_STORAGE = "KCN-II-VAULT";
export const PLAIN_STORAGE = "KCN-II";
export const IDLE_MS = 5 * 60 * 1000;

export type AuditEntry = {
  seq: number;
  at: string;
  action: string;
  prev: string;
  hash: string;
};

export type VaultMeta = {
  created: string;
  lastOpen: string;
  idleMs: number;
};

export type VaultPayload = {
  case: KcnState;
  audit: AuditEntry[];
  meta: VaultMeta;
};

export type SealedVault = {
  product: "KCN-II";
  kind: "sealed-vault";
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string;
  iv: string;
  ct: string;
  created: string;
};

let sessionKey: CryptoKey | null = null;
let unlocked = false;
let payload: VaultPayload | null = null;
let persistChain: Promise<void> = Promise.resolve();

function isSealed(v: unknown): v is SealedVault {
  return !!v && typeof v === "object" && (v as SealedVault).kind === "sealed-vault" && (v as SealedVault).v === 1;
}

function walkStrip(v: unknown): unknown {
  if (typeof v === "string" && v.startsWith("data:image")) return "[image-stripped]";
  if (Array.isArray(v)) return v.map(walkStrip);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = walkStrip(val);
    return o;
  }
  return v;
}

export function sanitizeCase(state: KcnState): KcnState {
  return walkStrip(JSON.parse(JSON.stringify(state))) as KcnState;
}

export function caseHasImageBlobs(state: KcnState | null | undefined): boolean {
  if (!state) return false;
  return JSON.stringify(state).includes("data:image");
}

export { cryptoReady };

export function vaultExists(): boolean {
  try {
    return !!localStorage.getItem(VAULT_STORAGE);
  } catch {
    return false;
  }
}

export function plaintextResidue(): boolean {
  try {
    return !!localStorage.getItem(PLAIN_STORAGE);
  } catch {
    return false;
  }
}

export function isUnlocked(): boolean {
  return unlocked && !!sessionKey;
}

export function readSealed(): SealedVault | null {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SealedVault;
    return isSealed(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function sealedStorageLooksClean(): boolean {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE) || "";
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!isSealed(parsed)) return false;
    const forbidden = ["passphrase", "password", "CryptoKey", "rawKey"];
    if (forbidden.some((k) => raw.toLowerCase().includes(k.toLowerCase()))) return false;
    return typeof parsed.ct === "string" && typeof parsed.salt === "string" && !("key" in parsed);
  } catch {
    return false;
  }
}

export async function createVault(passphrase: string, seed?: KcnState): Promise<void> {
  if (!cryptoReady()) throw new Error("Web Crypto is not available.");
  const salt = bytes(16);
  const key = await deriveKey(passphrase, salt);
  sessionKey = key;
  unlocked = true;
  const now = new Date().toISOString();
  const genesis = await chainAudit([], "VAULT_CREATED");
  const next: VaultPayload = {
    case: sanitizeCase(seed || emptyCase()),
    audit: genesis,
    meta: { created: now, lastOpen: now, idleMs: IDLE_MS },
  };
  const { iv, ct } = await encryptJson(key, next);
  const sealed: SealedVault = {
    product: "KCN-II",
    kind: "sealed-vault",
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter: KDF_ITER,
    salt: b64(salt),
    iv,
    ct,
    created: now,
  };
  localStorage.setItem(VAULT_STORAGE, JSON.stringify(sealed));
  overwriteWipe(PLAIN_STORAGE);
  payload = next;
}

export async function unlockVault(passphrase: string): Promise<VaultPayload> {
  const sealed = readSealed();
  if (!sealed) throw new Error("No sealed vault on this device.");
  const key = await deriveKey(passphrase, unb64(sealed.salt));
  let next: VaultPayload;
  try {
    next = await decryptJson<VaultPayload>(key, sealed.iv, sealed.ct);
  } catch {
    throw new Error("Passphrase did not open the vault.");
  }
  sessionKey = key;
  unlocked = true;
  next.meta.lastOpen = new Date().toISOString();
  next.case = sanitizeCase(next.case);
  next.audit = await chainAudit(next.audit, "VAULT_UNLOCKED");
  payload = next;
  await persistPayload();
  return next;
}

export function lockVault(): void {
  sessionKey = null;
  unlocked = false;
  payload = null;
}

export async function persistCase(state: KcnState): Promise<void> {
  if (!isUnlocked() || !payload) return;
  payload.case = sanitizeCase(state);
  payload.audit = await chainAudit(payload.audit, "CASE_SEALED");
  await persistPayload();
}

export function currentPayload(): VaultPayload | null {
  return payload;
}

export async function recordAudit(action: string): Promise<void> {
  if (!isUnlocked() || !payload) return;
  payload.audit = await chainAudit(payload.audit, action);
  await persistPayload();
}

async function persistPayload(): Promise<void> {
  const job = persistChain.then(async () => {
    if (!sessionKey || !payload) return;
    const sealed = readSealed();
    if (!sealed) return;
    payload.case = sanitizeCase(payload.case);
    const { iv, ct } = await encryptJson(sessionKey, payload);
    localStorage.setItem(VAULT_STORAGE, JSON.stringify({ ...sealed, iv, ct }));
  });
  persistChain = job.catch(() => undefined);
  await job;
}

export async function wipeVault(): Promise<void> {
  lockVault();
  overwriteWipe(VAULT_STORAGE);
  overwriteWipe(PLAIN_STORAGE);
  overwriteWipe("KCN-II-LEGAL");
}

export function sealedBackup(): string {
  const sealed = readSealed();
  if (!sealed) throw new Error("No sealed vault to export.");
  return JSON.stringify(sealed, null, 2);
}

export async function importSealed(raw: string, passphrase: string): Promise<VaultPayload> {
  const parsed = JSON.parse(raw) as SealedVault;
  if (!isSealed(parsed)) throw new Error("That file is not a KCN-II sealed vault.");
  const key = await deriveKey(passphrase, unb64(parsed.salt));
  const next = await decryptJson<VaultPayload>(key, parsed.iv, parsed.ct);
  sessionKey = key;
  unlocked = true;
  payload = { ...next, case: sanitizeCase(next.case) };
  localStorage.setItem(VAULT_STORAGE, JSON.stringify(parsed));
  overwriteWipe(PLAIN_STORAGE);
  payload.audit = await chainAudit(payload.audit, "VAULT_IMPORTED");
  await persistPayload();
  return payload;
}

export function migratePlaintext(): KcnState | null {
  try {
    const raw = localStorage.getItem(PLAIN_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KcnState;
    return parsed;
  } catch {
    return null;
  }
}

async function chainAudit(prev: AuditEntry[], action: string): Promise<AuditEntry[]> {
  const last = prev[prev.length - 1];
  const seq = (last?.seq || 0) + 1;
  const at = new Date().toISOString();
  const prevHash = last?.hash || "GENESIS";
  const hash = await sha256(`${seq}|${at}|${action}|${prevHash}`);
  return [...prev.slice(-199), { seq, at, action, prev: prevHash, hash }];
}

export async function verifyAudit(entries: AuditEntry[]): Promise<boolean> {
  let prevHash = "GENESIS";
  for (const e of entries) {
    const expect = await sha256(`${e.seq}|${e.at}|${e.action}|${prevHash}`);
    if (expect !== e.hash) return false;
    prevHash = e.hash;
  }
  return true;
}

function emptyCase(): KcnState {
  return {
    files: [],
    reading: "",
    notes: [],
    cases: [{ id: "vault", title: "Active Case", status: "OPEN", summary: "Sealed investigative workspace." }],
    activeCaseId: "vault",
    people: [],
    orgs: [],
    locations: [],
    findings: [],
    evidence: [],
    events: [],
    relations: [],
    chat: [],
    video: "",
    swarmLog: [],
    scans: [],
    lookups: [],
    custody: [],
    acquisitions: [],
    aliases: [],
    contradictions: [],
    activity: [],
    operator: "Investigator",
  };
}

export async function vaultFingerprint(): Promise<string> {
  const sealed = readSealed();
  if (!sealed) return "";
  return sha256(sealed.ct + sealed.salt + sealed.iv);
}
