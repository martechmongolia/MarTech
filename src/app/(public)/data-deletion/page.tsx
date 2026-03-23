import Link from "next/link";
import type { Metadata } from "next";
import { Alert } from "@/components/ui";

export const metadata: Metadata = {
  title: "Data Deletion — MarTech",
  description: "Request deletion of your data from MarTech."
};

type DataDeletionPageProps = {
  searchParams: Promise<{ confirmation?: string }>;
};

export default async function DataDeletionPage({ searchParams }: DataDeletionPageProps) {
  const sp = await searchParams;
  const confirmationRaw = typeof sp.confirmation === "string" ? sp.confirmation.trim() : "";
  const confirmationShort =
    confirmationRaw.length > 0 ? `${confirmationRaw.slice(0, 8)}…` : null;

  return (
    <main style={{ padding: "2rem", maxWidth: 780, margin: "0 auto", lineHeight: 1.7 }}>
      <nav style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        <Link href="/">← Home</Link>
        {" · "}
        <Link href="/privacy">Privacy Policy</Link>
        {" · "}
        <Link href="/terms">Terms of Service</Link>
      </nav>

      <h1>Data Deletion</h1>

      <p>
        You have the right to request deletion of your personal data from MarTech at any time. We comply with
        applicable data protection regulations and Meta&apos;s Platform Terms.
      </p>

      {confirmationShort ? (
        <Alert variant="success" style={{ marginBottom: "1.25rem" }}>
          <strong>Meta data removal processed.</strong> If you arrived here after removing MarTech in Facebook, your
          Meta OAuth connection and data imported from Meta have been removed or scheduled for removal. Use this
          reference if you contact support: <code>{confirmationShort}</code>
        </Alert>
      ) : null}

      <h2>What Gets Deleted</h2>

      <h3 style={{ fontSize: "1.05rem", marginBottom: "0.35rem" }}>A. Facebook app removal (automatic)</h3>
      <p>
        When you remove MarTech in <strong>Facebook Settings → Apps and Websites</strong>, Meta sends our servers a
        signed <strong>data deletion callback</strong>. We verify the request and <strong>immediately delete</strong>{" "}
        your Meta OAuth tokens, connected Facebook Pages in MarTech, synced metrics and post-level data from Meta, and
        AI analysis tied to those Pages (database rows are removed in the same request).
      </p>
      <p style={{ marginTop: "0.5rem" }}>
        This path removes <strong>data received from Meta</strong>. It does not by itself delete your Supabase login,
        organization record, subscription, or billing history — use <strong>Option 1 (email)</strong> below for a full
        account deletion request.
      </p>

      <h3 style={{ fontSize: "1.05rem", marginTop: "1.25rem", marginBottom: "0.35rem" }}>
        B. Full deletion request (email)
      </h3>
      <p>When you request full account deletion by email, we will remove or anonymize, where applicable:</p>
      <ul>
        <li>Your user profile and authentication data</li>
        <li>Your organization and membership records</li>
        <li>Connected Facebook/Meta account data and encrypted access tokens</li>
        <li>All synced Page metrics, post metrics, and analytics data</li>
        <li>AI-generated analysis reports and recommendations</li>
        <li>Billing records and invoice history (subject to legal retention below)</li>
        <li>Associated subscription and usage data</li>
      </ul>

      <h2>What Is Retained</h2>
      <ul>
        <li>Anonymized, aggregated system-level analytics (no personal data)</li>
        <li>
          Payment transaction records required by law for accounting purposes (retained for the legally required
          period)
        </li>
      </ul>

      <h2>How to Request Deletion</h2>

      <h3>Option 1: Email Request</h3>
      <p>
        Send an email to <a href="mailto:support@martech.mn">support@martech.mn</a> with the subject line{" "}
        <strong>&quot;Data Deletion Request&quot;</strong> and include the email address associated with your MarTech
        account. We will process your request within <strong>30 days</strong>.
      </p>

      <h3>Option 2: Facebook App Settings</h3>
      <p>You can remove MarTech&apos;s access through Facebook directly:</p>
      <ol>
        <li>Go to <strong>Facebook Settings &amp; Privacy</strong> → <strong>Settings</strong></li>
        <li>Click <strong>Apps and Websites</strong></li>
        <li>Find <strong>MarTech</strong> and click <strong>Remove</strong></li>
        <li>Check the box to delete data MarTech received about you, if offered</li>
      </ol>
      <p>
        Meta will call our callback URL; we process Meta-linked data removal automatically as described in{" "}
        <strong>section A</strong> above. You will receive a confirmation code in Meta&apos;s flow and can use the
        status URL Meta shows (or this page with a confirmation parameter) as a reference.
      </p>

      <h2>Processing Timeline</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>Action</th>
            <th style={{ padding: "0.5rem" }}>Timeline</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: "0.5rem" }}>Meta-linked data (Facebook removal callback)</td>
            <td style={{ padding: "0.5rem" }}>Immediately when the callback is received</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: "0.5rem" }}>Full account deletion (email request)</td>
            <td style={{ padding: "0.5rem" }}>Within 30 days</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: "0.5rem" }}>Confirmation email sent (full request)</td>
            <td style={{ padding: "0.5rem" }}>Upon completion</td>
          </tr>
        </tbody>
      </table>

      <h2>Verification</h2>
      <p>
        You can verify the status of your deletion request by contacting{" "}
        <a href="mailto:support@martech.mn">support@martech.mn</a>. Include the confirmation code you received (if
        applicable) for faster processing.
      </p>

      <h2>Questions</h2>
      <p>
        For any questions about data deletion, contact us at:{" "}
        <a href="mailto:support@martech.mn">support@martech.mn</a>
      </p>

      <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", fontSize: "0.85rem", color: "#64748b" }}>
        <Link href="/privacy">Privacy Policy</Link>
        {" · "}
        <Link href="/terms">Terms of Service</Link>
        {" · "}
        <Link href="/login">Sign In</Link>
      </footer>
    </main>
  );
}
