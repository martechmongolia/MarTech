/**
 * Sanitises raw error strings (often Meta Graph JSON or stack traces) into
 * something safe to render to end users. Strips access tokens, secrets, and
 * internal trace identifiers; extracts the human-readable message when the
 * error body is JSON.
 */
export function sanitizeErrorMessage(raw: string): string {
  // Try to extract the user-friendly message from Meta Graph API JSON errors
  try {
    const parsed = JSON.parse(raw.replace(/^[^{]*/, ""));
    if (parsed?.error?.message && typeof parsed.error.message === "string") {
      return parsed.error.message;
    }
  } catch {
    // not JSON — fall through
  }

  // Strip known sensitive patterns (tokens, secrets, trace IDs)
  return raw
    .replace(/"fbtrace_id"\s*:\s*"[^"]*"/g, "")
    .replace(/[a-z_]*access[_.]?token[a-z_]*[=:][^,}\s"']*/gi, "")
    .replace(/[a-z_]*secret[a-z_]*[=:][^,}\s"']*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
}
