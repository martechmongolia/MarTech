import { readImpersonationCookie } from "@/modules/admin/impersonation";
import { endImpersonationAction } from "@/modules/admin/impersonation-actions";

/**
 * Sticky banner shown at the top of any page when an admin is currently
 * impersonating another user. Reads the httpOnly `martech_impersonation`
 * cookie server-side; renders nothing for non-impersonating sessions.
 */
export async function ImpersonationBanner() {
  const cookie = await readImpersonationCookie();
  if (!cookie) return null;

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        background: "var(--color-status-warning-bg, #fff7ed)",
        color: "var(--color-status-warning-text, #9a3412)",
        borderBottom: "1px solid var(--color-status-warning-border, #fed7aa)",
        padding: "0.5rem 1rem",
        fontSize: "0.8125rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-2)",
        flexWrap: "wrap"
      }}
    >
      <span>
        ⚠️ Та <strong>{cookie.targetEmail}</strong>-ийн account-оор нэвтэрч байна (admin:{" "}
        <code>{cookie.adminEmail}</code>)
      </span>
      <form action={endImpersonationAction}>
        <button
          type="submit"
          style={{
            background: "transparent",
            border: "1px solid currentColor",
            color: "inherit",
            padding: "0.25rem 0.625rem",
            borderRadius: "4px",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Admin-д буцах
        </button>
      </form>
    </div>
  );
}
