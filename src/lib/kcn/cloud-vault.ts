import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { vaultKey } from "./accounts";

const MAX_SEALED = 3_500_000;

function cleanSealed(raw: string): string | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (
      !v ||
      v.kind !== "sealed-vault" ||
      v.v !== 1 ||
      typeof v.ct !== "string" ||
      typeof v.salt !== "string" ||
      typeof v.iv !== "string"
    ) {
      return null;
    }
    if (typeof v.ct === "string" && v.ct.length > MAX_SEALED) return null;
    return JSON.stringify({
      product: "KCN-II",
      kind: "sealed-vault",
      v: 1,
      kdf: v.kdf || "PBKDF2-SHA256",
      iter: v.iter,
      salt: v.salt,
      iv: v.iv,
      ct: v.ct,
      created: v.created,
      investigatorId: v.investigatorId,
    });
  } catch {
    return null;
  }
}

function ownerOf(sealed: string): string | null {
  try {
    const v = JSON.parse(sealed) as { investigatorId?: string };
    return typeof v.investigatorId === "string" && v.investigatorId ? v.investigatorId : null;
  } catch {
    return null;
  }
}

function belongsTo(sealed: string, userId: string): boolean {
  const owner = ownerOf(sealed);
  return !owner || owner === userId;
}

export const pullVault = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ sealed: string; updated_at: string }>`
      select sealed, updated_at from kcn_vaults where user_id = ${context.userId} limit 1
    `;
    const row = rows[0];
    if (!row?.sealed) return null;
    const sealed = cleanSealed(row.sealed);
    if (!sealed) return null;
    if (!belongsTo(sealed, context.userId)) return null;
    return { sealed, updatedAt: row.updated_at };
  });

export const pushVault = createServerFn({ method: "POST" })
  .validator((input: { sealed: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sealed = cleanSealed(String(data.sealed || ""));
    if (!sealed) return { ok: false as const, error: "Not a sealed vault." };
    if (!belongsTo(sealed, context.userId)) {
      return { ok: false as const, error: "Vault does not belong to this account." };
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into kcn_vaults (user_id, sealed, updated_at)
      values (${context.userId}, ${sealed}, now())
      on conflict (user_id) do update set sealed = excluded.sealed, updated_at = now()
    `;
    return { ok: true as const };
  });

export const deleteCloudVault = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from kcn_vaults where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export async function pushAccountVault(ownerId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(vaultKey(ownerId));
    if (!raw) return;
    if (!belongsTo(raw, ownerId)) return;
    await pushVault({ data: { sealed: raw } });
  } catch {
    /* signed out or offline — local seal still holds */
  }
}

export async function pullAccountVault(ownerId: string): Promise<boolean> {
  try {
    const cloud = await pullVault();
    if (!cloud?.sealed) return false;
    const cleaned = cleanSealed(cloud.sealed);
    if (!cleaned) return false;
    if (!belongsTo(cleaned, ownerId)) return false;
    localStorage.setItem(vaultKey(ownerId), cleaned);
    return true;
  } catch {
    return false;
  }
}
