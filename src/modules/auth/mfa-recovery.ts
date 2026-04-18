/**
 * MFA recovery codes — crypto-hashed single-use backup codes for users who
 * lose their authenticator device. 10 codes are generated when a user
 * enrolls a TOTP factor (see mfa-actions.ts). Consuming a code unenrolls
 * every verified TOTP factor, forcing the user to re-enroll on the new
 * device. See mfa-recovery-actions.ts for the wrapping server actions.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

// Ambiguous characters (I, O, 0, 1) removed to avoid user confusion. 32 chars
// → ~50 bits entropy per 10-char code. Plenty for a one-time backup code.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_GROUPS = 2;
const GROUP_LEN = 5;
const BATCH_SIZE = 10;
const HASH_KEYLEN = 32;
const SALT_LEN = 16;

function generatePlaintextCode(): string {
  const buf = randomBytes(CODE_GROUPS * GROUP_LEN);
  let s = "";
  for (let i = 0; i < buf.length; i++) {
    s += ALPHABET[buf[i] % ALPHABET.length];
    if ((i + 1) % GROUP_LEN === 0 && i !== buf.length - 1) s += "-";
  }
  return s;
}

/** User input normalisation — accept lowercase, with or without dashes/spaces. */
function normalize(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

async function hashCode(code: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scrypt(normalize(code), salt, HASH_KEYLEN);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

async function verifyHash(code: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, "base64url");
    expected = Buffer.from(hashB64, "base64url");
  } catch {
    return false;
  }
  if (salt.length !== SALT_LEN || expected.length !== HASH_KEYLEN) return false;
  const actual = await scrypt(normalize(code), salt, expected.length);
  return timingSafeEqual(actual, expected);
}

/**
 * Replace all of the user's recovery codes with a fresh batch of 10. Returns
 * the plaintext codes for the caller to surface to the user *once*. After
 * this returns, the plaintext is gone — only the per-row hashes remain.
 */
export async function generateRecoveryCodesForUser(userId: string): Promise<string[]> {
  const admin = getSupabaseAdminClient();

  const { error: delErr } = await admin
    .from("mfa_recovery_codes")
    .delete()
    .eq("user_id", userId);
  if (delErr) {
    throw new Error(`recovery code delete failed: ${delErr.message}`);
  }

  const plaintext: string[] = [];
  const rows: Array<{ user_id: string; code_hash: string }> = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const code = generatePlaintextCode();
    plaintext.push(code);
    rows.push({ user_id: userId, code_hash: await hashCode(code) });
  }

  const { error: insErr } = await admin.from("mfa_recovery_codes").insert(rows);
  if (insErr) {
    throw new Error(`recovery code insert failed: ${insErr.message}`);
  }

  return plaintext;
}

export async function countActiveRecoveryCodes(userId: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { count } = await admin
    .from("mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);
  return count ?? 0;
}

export type ConsumeRecoveryCodeResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_used" | "update_failed" };

/**
 * Exchange a plaintext code for a one-time consumption. Walks every row for
 * the user, scrypt-compares against each hash (constant-time). On first
 * match, marks used_at and returns. Row scan is O(10) so no clever lookup
 * is needed; using a hash-table lookup here would require a deterministic
 * (unsalted) hash and defeats the point of a salted store.
 */
export async function consumeRecoveryCode(
  userId: string,
  rawCode: string
): Promise<ConsumeRecoveryCodeResult> {
  const admin = getSupabaseAdminClient();
  const { data: rows } = await admin
    .from("mfa_recovery_codes")
    .select("id, code_hash, used_at")
    .eq("user_id", userId);

  if (!rows || rows.length === 0) {
    return { ok: false, reason: "not_found" };
  }

  for (const row of rows) {
    if (await verifyHash(rawCode, row.code_hash)) {
      if (row.used_at) return { ok: false, reason: "already_used" };
      const { error } = await admin
        .from("mfa_recovery_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("used_at", null);
      if (error) return { ok: false, reason: "update_failed" };
      return { ok: true };
    }
  }
  return { ok: false, reason: "not_found" };
}

// Exposed for unit tests. Not part of the public API.
export const __testing = {
  generatePlaintextCode,
  hashCode,
  verifyHash,
  normalize
};
