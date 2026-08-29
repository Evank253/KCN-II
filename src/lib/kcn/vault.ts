import type { KcnState } from "./store";
import {
  activeInvestigatorId,
  autoSecretKey,
  easyKey,
  ensureInvestigator,
  investigatorHasVault,
  listInvestigators,
  makeAutoSecret,
  readAutoSecret,
  registerInvestigator,
  removeInvestigator,
  setActiveInvestigatorId,
  touchInvestigator,
  vaultKey,
  writeAutoSecret,
} from "./accounts";
import { deleteCloudVault, pullAccountVault, pushAccountVault } from "./cloud-vault";
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
export const IDLE_MS = 30 * 60 * 1000;

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
  investigatorId?: string;
  operatorName?: string;
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
  investigatorId?: string;
};

let sessionKey: CryptoKey | null = null;
let unlocked = false;
let payload: VaultPayload | null = null;
let activeId: string | null = null;
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

export function currentInvestigatorId(): string | null {
  return activeId;
}

export function vaultExists(): boolean {
  return listInvestigators().some((u) => investigatorHasVault(u.id)) || !!readSealedRaw(VAULT_STORAGE);
}

export function vaultExistsFor(id: string): boolean {
  return investigatorHasVault(id);
}

export function plaintextResidue(): boolean {
  try {
    return !!localStorage.getItem(PLAIN_STORAGE);
  } catch {
    return false;
  }
}

export function isUnlocked(): boolean {
  return unlocked && !!sessionKey && !!activeId;
}

function readSealedRaw(key: string): SealedVault | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SealedVault;
    return isSealed(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readSealedFor(id: string): SealedVault | null {
  return readSealedRaw(vaultKey(id));
}

export function readSealed(): SealedVault | null {
  if (activeId) return readSealedFor(activeId);
  return readSealedRaw(VAULT_STORAGE);
}

export function sealedStorageLooksClean(): boolean {
  try {
    const sealed = readSealed();
    if (!sealed) return false;
    const raw = JSON.stringify(sealed);
    const forbidden = ["passphrase", "password", "CryptoKey", "rawKey"];
    if (forbidden.some((k) => raw.toLowerCase().includes(k.toLowerCase()))) return false;
    return typeof sealed.ct === "string" && typeof sealed.salt === "string" && !("key" in sealed);
  } catch {
    return false;
  }
}

export async function createVault(passphrase: string, seed?: KcnState, operatorName?: string, ownerId?: string): Promise<void> {
  if (!cryptoReady()) throw new Error("Web Crypto is not available.");
  const name = (operatorName || "Investigator").trim().slice(0, 48) || "Investigator";
  const user = ownerId ? ensureInvestigator(ownerId, name) : registerInvestigator(name);
  activeId = user.id;
  const salt = bytes(16);
  const key = await deriveKey(passphrase, salt);
  sessionKey = key;
  unlocked = true;
  const now = new Date().toISOString();
  const genesis = await chainAudit([], "VAULT_CREATED");
  const seeded = sanitizeCase(seed || emptyCase());
  seeded.operator = user.name;
  const next: VaultPayload = {
    case: seeded,
    audit: genesis,
    meta: { created: now, lastOpen: now, idleMs: IDLE_MS, investigatorId: user.id, operatorName: user.name },
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
    investigatorId: user.id,
  };
  localStorage.setItem(vaultKey(user.id), JSON.stringify(sealed));
  overwriteWipe(PLAIN_STORAGE);
  payload = next;
  touchInvestigator(user.id);
  if (user.id !== "guest") void pushAccountVault(user.id);
}

export async function unlockVault(passphrase: string, investigatorId?: string): Promise<VaultPayload> {
  const id = investigatorId || activeInvestigatorId() || listInvestigators()[0]?.id;
  if (!id) throw new Error("No investigator on this device.");
  const sealed = readSealedFor(id);
  if (!sealed) throw new Error("No sealed vault for that investigator.");
  const key = await deriveKey(passphrase, unb64(sealed.salt));
  let next: VaultPayload;
  try {
    next = await decryptJson<VaultPayload>(key, sealed.iv, sealed.ct);
  } catch {
    throw new Error("Passphrase did not open that investigator's vault.");
  }
  if (next.meta?.investigatorId && next.meta.investigatorId !== id) {
    throw new Error("That vault does not belong to this investigator.");
  }
  activeId = id;
  setActiveInvestigatorId(id);
  sessionKey = key;
  unlocked = true;
  next.meta = next.meta || { created: sealed.created, lastOpen: "", idleMs: IDLE_MS };
  next.meta.lastOpen = new Date().toISOString();
  next.meta.investigatorId = id;
  const user = listInvestigators().find((u) => u.id === id);
  if (user) {
    next.meta.operatorName = user.name;
    next.case = { ...sanitizeCase(next.case), operator: user.name };
  } else {
    next.case = sanitizeCase(next.case);
  }
  next.audit = await chainAudit(next.audit || [], "VAULT_UNLOCKED");
  payload = next;
  touchInvestigator(id);
  await persistPayload();
  return next;
}

export function lockVault(): void {
  sessionKey = null;
  unlocked = false;
  payload = null;
  activeId = null;
}

function enqueuePersist(job: () => Promise<void>): Promise<void> {
  const run = persistChain.then(job);
  persistChain = run.catch(() => undefined);
  return persistChain;
}

function ownerGuard(id: string, data: VaultPayload): boolean {
  return !data.meta?.investigatorId || data.meta.investigatorId === id;
}

async function writeSealed(id: string, key: CryptoKey, data: VaultPayload): Promise<void> {
  if (!ownerGuard(id, data)) return;
  const sealed = readSealedFor(id);
  if (!sealed) return;
  data.case = sanitizeCase(data.case);
  const { iv, ct } = await encryptJson(key, data);
  localStorage.setItem(vaultKey(id), JSON.stringify({ ...sealed, iv, ct, investigatorId: id }));
  if (id !== "guest") void pushAccountVault(id);
}

export async function persistCase(state: KcnState): Promise<void> {
  const id = activeId;
  const key = sessionKey;
  const data = payload;
  if (!unlocked || !id || !key || !data) return;
  if (!ownerGuard(id, data)) return;
  data.case = sanitizeCase(state);
  await enqueuePersist(async () => {
    if (!ownerGuard(id, data)) return;
    data.audit = await chainAudit(data.audit, "CASE_SEALED");
    await writeSealed(id, key, data);
  });
}

export function currentPayload(): VaultPayload | null {
  return payload;
}

export async function recordAudit(action: string): Promise<void> {
  const id = activeId;
  const key = sessionKey;
  const data = payload;
  if (!unlocked || !id || !key || !data) return;
  if (!ownerGuard(id, data)) return;
  await enqueuePersist(async () => {
    if (!ownerGuard(id, data)) return;
    data.audit = await chainAudit(data.audit, action);
    await writeSealed(id, key, data);
  });
}

async function persistPayload(): Promise<void> {
  const id = activeId;
  const key = sessionKey;
  const data = payload;
  if (!id || !key || !data) return;
  if (!ownerGuard(id, data)) return;
  await enqueuePersist(async () => {
    if (!ownerGuard(id, data)) return;
    await writeSealed(id, key, data);
  });
}

export async function wipeVault(targetId?: string): Promise<void> {
  const id = targetId || activeId || activeInvestigatorId();
  lockVault();
  await persistChain.catch(() => undefined);
  if (id) {
    overwriteWipe(vaultKey(id));
    overwriteWipe(easyKey(id));
    overwriteWipe(autoSecretKey(id));
    removeInvestigator(id);
  }
  overwriteWipe(PLAIN_STORAGE);
  if (id && id !== "guest") {
    try {
      await deleteCloudVault();
    } catch {
      /* still wiped locally */
    }
  }
}

export function sealedBackup(): string {
  const sealed = readSealed();
  if (!sealed) throw new Error("No sealed vault to export.");
  return JSON.stringify(sealed, null, 2);
}

export async function importSealed(raw: string, passphrase: string, operatorName?: string, ownerId?: string): Promise<VaultPayload> {
  const parsed = JSON.parse(raw) as SealedVault;
  if (!isSealed(parsed)) throw new Error("That file is not a KCN-II sealed vault.");
  const key = await deriveKey(passphrase, unb64(parsed.salt));
  const next = await decryptJson<VaultPayload>(key, parsed.iv, parsed.ct);
  const name = (operatorName || next.meta?.operatorName || next.case?.operator || "Investigator").trim().slice(0, 48);
  const user = ownerId ? ensureInvestigator(ownerId, name) : registerInvestigator(name);
  next.meta = {
    ...(next.meta || { created: parsed.created, lastOpen: "", idleMs: IDLE_MS }),
    investigatorId: user.id,
    operatorName: user.name,
    lastOpen: new Date().toISOString(),
  };
  activeId = user.id;
  sessionKey = key;
  unlocked = true;
  next.case = sanitizeCase({ ...next.case, operator: user.name });
  payload = next;
  localStorage.setItem(vaultKey(user.id), JSON.stringify({ ...parsed, investigatorId: user.id }));
  overwriteWipe(PLAIN_STORAGE);
  payload.audit = await chainAudit(payload.audit || [], "VAULT_IMPORTED");
  touchInvestigator(user.id);
  await persistPayload();
  if (user.id !== "guest") void pushAccountVault(user.id);
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
  return [...(prev || []).slice(-199), { seq, at, action, prev: prevHash, hash }];
}

export async function verifyAudit(entries: AuditEntry[]): Promise<boolean> {
  let prevHash = "GENESIS";
  for (const e of entries || []) {
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

export async function openAccountSession(userId: string, operatorName?: string): Promise<"opened" | "needs-pass"> {
  const id = userId || "guest";
  const name = (operatorName || "Investigator").trim().slice(0, 48) || "Investigator";
  if (id !== "guest") {
    try {
      await pullAccountVault(id);
    } catch {
      /* offline */
    }
  }
  const auto = readAutoSecret(id);
  if (investigatorHasVault(id) || readSealedFor(id)) {
    if (auto) {
      try {
        await unlockVault(auto, id);
        return "opened";
      } catch {
        return "needs-pass";
      }
    }
    return "needs-pass";
  }
  const secret = makeAutoSecret();
  writeAutoSecret(id, secret);
  await createVault(secret, undefined, name, id);
  return "opened";
}
