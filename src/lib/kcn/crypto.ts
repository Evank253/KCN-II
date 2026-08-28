const ENC = new TextEncoder();
const DEC = new TextDecoder();
export const KDF_ITER = 250_000;
export const VAULT_AAD = ENC.encode("KCN-II-VAULT-1");

function src(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export function cryptoReady(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

export function bytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export async function sha256(data: string | Uint8Array): Promise<string> {
  if (!cryptoReady()) throw new Error("Web Crypto is not available.");
  const buf = typeof data === "string" ? ENC.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", src(buf instanceof Uint8Array ? buf : new Uint8Array()));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", ENC.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: src(salt), iterations: KDF_ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(key: CryptoKey, data: unknown): Promise<{ iv: string; ct: string }> {
  const iv = bytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: src(iv), additionalData: src(VAULT_AAD) },
    key,
    ENC.encode(JSON.stringify(data)),
  );
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptJson<T>(key: CryptoKey, ivB64: string, ctB64: string): Promise<T> {
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: src(unb64(ivB64)), additionalData: src(VAULT_AAD) },
    key,
    src(unb64(ctB64)),
  );
  return JSON.parse(DEC.decode(raw)) as T;
}

export function passphraseScore(p: string): { ok: boolean; label: string } {
  const len = p.length;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (len < 12) return { ok: false, label: "Too short — use 12+ characters" };
  if (len >= 16 && classes >= 3) return { ok: true, label: "Strong passphrase" };
  if (len >= 12) return { ok: true, label: "Acceptable passphrase" };
  return { ok: false, label: "Too weak" };
}

export function overwriteWipe(key: string) {
  try {
    const junk = b64(bytes(256));
    localStorage.setItem(key, junk);
    localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

/** Live AES-256-GCM control test used by IDPC-1.0. Not a mock. */
export async function liveCryptoProbe(): Promise<{ ok: boolean; evidence: string }> {
  if (!cryptoReady()) {
    return { ok: false, evidence: "Web Crypto SubtleCrypto is not available in this browser." };
  }
  const salt = bytes(16);
  const key = await deriveKey("KCN-II-probe-passphrase-12+", salt);
  const sample = { mark: "investigator-sensitive", n: 7 };
  const { iv, ct } = await encryptJson(key, sample);
  const back = await decryptJson<{ mark: string; n: number }>(key, iv, ct);
  if (back.mark !== sample.mark || back.n !== 7) {
    return { ok: false, evidence: "AES-GCM roundtrip failed." };
  }
  const flipped = unb64(ct);
  flipped[0] ^= 0xff;
  let tamperRejected = false;
  try {
    await decryptJson(key, iv, b64(flipped));
  } catch {
    tamperRejected = true;
  }
  if (!tamperRejected) return { ok: false, evidence: "Tampered ciphertext was accepted." };
  const wrong = await deriveKey("KCN-II-wrong-passphrase-xx", salt);
  let wrongRejected = false;
  try {
    await decryptJson(wrong, iv, ct);
  } catch {
    wrongRejected = true;
  }
  if (!wrongRejected) return { ok: false, evidence: "Wrong passphrase opened the ciphertext." };
  return {
    ok: true,
    evidence:
      "Live AES-256-GCM: roundtrip ok, tamper rejected, wrong passphrase rejected. PBKDF2-SHA256 250000 iterations, non-extractable key, AAD KCN-II-VAULT-1.",
  };
}
