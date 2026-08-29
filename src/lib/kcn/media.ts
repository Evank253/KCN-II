const DB_NAME = "KCN-II-MEDIA";
const STORE = "blobs";
const MAX_BYTES = 90 * 1024 * 1024;

export type MediaMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
};

const memory = new Map<string, { blob: Blob; name: string; mime: string }>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("media db"));
  });
}

export async function putMedia(id: string, file: Blob, name: string, mime = ""): Promise<MediaMeta> {
  if (file.size > MAX_BYTES) throw new Error("That file is too large to keep on this device (90 MB cap).");
  const kind = mime || file.type || "application/octet-stream";
  memory.set(id, { blob: file, name, mime: kind });
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ id, name, mime: kind, size: file.size, blob: file });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("media write"));
    });
    db.close();
  } catch {
    /* session memory still holds the original */
  }
  return { id, name, mime: kind, size: file.size };
}

export async function getMedia(id: string): Promise<{ blob: Blob; name: string; mime: string } | null> {
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const db = await openDb();
    const row = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as Record<string, unknown> | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!row?.blob) return null;
    const got = { blob: row.blob as Blob, name: String(row.name || ""), mime: String(row.mime || "") };
    memory.set(id, got);
    return got;
  } catch {
    return null;
  }
}

export async function dropMedia(id: string): Promise<void> {
  memory.delete(id);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* gone from memory */
  }
}

export const MEDIA_CAP = MAX_BYTES;
