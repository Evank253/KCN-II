export type Investigator = {
  id: string;
  name: string;
  created: string;
  lastOpen: string;
};

const REGISTRY = "KCN-II-USERS";
const ACTIVE = "KCN-II-ACTIVE";
export const LEGACY_VAULT = "KCN-II-VAULT";

function nid() {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 10) : Math.random().toString(36).slice(2, 12);
}

function readReg(): Investigator[] {
  try {
    const raw = localStorage.getItem(REGISTRY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { users?: Investigator[] };
    return Array.isArray(parsed.users) ? parsed.users.filter((u) => u && u.id && u.name) : [];
  } catch {
    return [];
  }
}

function writeReg(users: Investigator[]) {
  try {
    localStorage.setItem(REGISTRY, JSON.stringify({ v: 1, users }));
  } catch {
    /* private mode */
  }
}

export function vaultKey(id: string) {
  return id === "legacy" ? LEGACY_VAULT : `KCN-II-VAULT:${id}`;
}

export function easyKey(id: string) {
  return `KCN-II-EASY:${id}`;
}

export function autoSecretKey(id: string) {
  return `KCN-II-AUTOKEY:${id}`;
}

export function readAutoSecret(id: string): string | null {
  try {
    return localStorage.getItem(autoSecretKey(id));
  } catch {
    return null;
  }
}

export function writeAutoSecret(id: string, secret: string) {
  try {
    localStorage.setItem(autoSecretKey(id), secret);
  } catch {
    /* private mode */
  }
}

export function makeAutoSecret(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export function migrateLegacyInvestigators(): Investigator[] {
  const users = readReg();
  try {
    const legacy = localStorage.getItem(LEGACY_VAULT);
    if (legacy && !users.some((u) => u.id === "legacy" || vaultKey(u.id) === LEGACY_VAULT)) {
      const next: Investigator = {
        id: "legacy",
        name: "Investigator",
        created: new Date().toISOString(),
        lastOpen: "",
      };
      writeReg([next, ...users]);
      return [next, ...users];
    }
  } catch {
    /* ignore */
  }
  return users;
}

export function listInvestigators(): Investigator[] {
  return migrateLegacyInvestigators();
}

export function getInvestigator(id: string): Investigator | null {
  return listInvestigators().find((u) => u.id === id) || null;
}

export function activeInvestigatorId(): string | null {
  try {
    return localStorage.getItem(ACTIVE);
  } catch {
    return null;
  }
}

export function setActiveInvestigatorId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(ACTIVE);
    else localStorage.setItem(ACTIVE, id);
  } catch {
    /* private mode */
  }
}

export function ensureInvestigator(id: string, name: string): Investigator {
  const existing = getInvestigator(id);
  if (existing) {
    setActiveInvestigatorId(id);
    return existing;
  }
  const trimmed = (name || "Investigator").trim().slice(0, 48) || "Investigator";
  const user: Investigator = {
    id,
    name: trimmed,
    created: new Date().toISOString(),
    lastOpen: "",
  };
  writeReg([...listInvestigators(), user]);
  setActiveInvestigatorId(id);
  return user;
}

export function registerInvestigator(name: string): Investigator {
  const trimmed = (name || "Investigator").trim().slice(0, 48) || "Investigator";
  const user: Investigator = {
    id: nid(),
    name: trimmed,
    created: new Date().toISOString(),
    lastOpen: "",
  };
  writeReg([...listInvestigators(), user]);
  setActiveInvestigatorId(user.id);
  return user;
}

export function touchInvestigator(id: string) {
  const users = listInvestigators().map((u) => (u.id === id ? { ...u, lastOpen: new Date().toISOString() } : u));
  writeReg(users);
  setActiveInvestigatorId(id);
}

export function renameInvestigator(id: string, name: string) {
  const trimmed = name.trim().slice(0, 48);
  if (!trimmed) return;
  writeReg(listInvestigators().map((u) => (u.id === id ? { ...u, name: trimmed } : u)));
}

export function removeInvestigator(id: string) {
  writeReg(listInvestigators().filter((u) => u.id !== id));
  if (activeInvestigatorId() === id) setActiveInvestigatorId(null);
}

export function investigatorHasVault(id: string): boolean {
  try {
    return !!localStorage.getItem(vaultKey(id));
  } catch {
    return false;
  }
}
