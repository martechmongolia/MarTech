import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — MarTech",
  description: "How MarTech collects, uses, and protects your data."
};

export default function PrivacyPolicyPage() {
  const updated = "March 22, 2026";

  return (
    <main style={{ padding: "2rem", maxWidth: 780, margin: "0 auto", lineHeight: 1.7 }}>
      <nav style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        <Link href="/">← Home</Link>
        {" · "}
        <Link href="/terms">Terms of Service</Link>
        {" · "}
        <Link href="/data-deletion">Data Deletion</Link>
      </nav>

      <h1>Privacy Policy</h1>
      <p style={{ color: "#64748b" }}>Last updated: {updated}</p>

      <p>
        MarTech (&quot;we&quot;, &quot;us&quot;, or &quot;the Service&quot;) is a social media analytics platform operated
        by MarTech Mongolia. This Privacy Policy explains how we collect, use, store, and share your information when you
        use our Service.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>1.1 Account Information</h3>
      <p>
        When you sign up, we collect your <strong>email address</strong> for authentication purposes. We use a
        passwordless sign-in flow (magic links) powered by Supabase Auth.
      </p>

      <h3>1.2 Organization Data</h3>
      <p>
        You create an organization name and slug. This is stored in our database and associated with your account.
      </p>

      <h3>1.3 Facebook / Meta Data</h3>
      <p>
        When you connect your Facebook account, we request the following permissions:
      </p>
      <ul>
        <li><code>pages_show_list</code> — to list your Facebook Pages</li>
        <li><code>pages_read_engagement</code> — to read engagement metrics</li>
        <li><code>pages_read_user_content</code> — to read page posts</li>
        <li><code>read_insights</code> — to read page analytics and insights</li>
      </ul>
      <p>
        We store encrypted access tokens to retrieve your Page insights. We collect page-level metrics (followers,
        reach, impressions, engagement) and post-level metrics (reactions, comments, shares). We do <strong>not</strong>{" "}
        collect personal data about your page followers or audience members.
      </p>

      <h3>1.4 Payment Information</h3>
      <p>
        Payments are processed through QPay. We store invoice records and payment transaction IDs but do <strong>not</strong>{" "}
        store bank account numbers, card details, or other financial credentials.
      </p>

      <h3>1.5 Usage and Analytics</h3>
      <p>
        We may collect basic usage data such as page views and feature usage to improve the Service. We do not use
        third-party advertising trackers.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Authenticate your identity and manage your account</li>
        <li>Sync and analyze your Facebook Page performance data</li>
        <li>Generate AI-powered insights and recommendations for your pages</li>
        <li>Process subscription payments via QPay</li>
        <li>Communicate service-related notices (e.g., login links, payment confirmations)</li>
        <li>Improve and maintain the Service</li>
      </ul>

      <h2>3. Data Storage and Security</h2>
      <p>
        Your data is stored on <strong>Supabase</strong> (PostgreSQL) with Row Level Security (RLS) enforced, ensuring
        users can only access their own organization&apos;s data. Facebook access tokens are encrypted at rest using
        AES-256 encryption. The Service is hosted on <strong>Vercel</strong> with HTTPS enforced on all connections.
      </p>

      <h2>4. Data Sharing</h2>
      <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties except:</p>
      <ul>
        <li><strong>Service providers</strong>: Supabase (database), Vercel (hosting), Meta (Facebook API), QPay (payments), OpenAI (AI analysis)</li>
        <li><strong>Legal requirements</strong>: If required by law, regulation, or legal process</li>
      </ul>
      <p>
        AI analysis uses anonymized, aggregated page metrics only. No personally identifiable information is sent to
        OpenAI.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active. When you delete your account or request data
        deletion, we remove your personal data within 30 days. Anonymized, aggregated analytics may be retained for
        service improvement.
      </p>

      <h2>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> your personal data stored by the Service</li>
        <li><strong>Correct</strong> inaccurate data in your profile or organization settings</li>
        <li><strong>Delete</strong> your data by visiting our <Link href="/data-deletion">Data Deletion</Link> page</li>
        <li><strong>Revoke</strong> Facebook access by disconnecting your Meta account in Settings or through Facebook&apos;s app settings</li>
        <li><strong>Export</strong> your data by contacting us</li>
      </ul>

      <h2>7. Cookies</h2>
      <p>
        We use essential cookies only for authentication session management. We do not use advertising or tracking
        cookies.
      </p>

      <h2>8. Children&apos;s Privacy</h2>
      <p>
        The Service is not intended for users under 18 years of age. We do not knowingly collect data from children.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a
        notice on the Service. Continued use of the Service after changes constitutes acceptance.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy or your data, contact us at:{" "}
        <a href="mailto:support@martech.mn">support@martech.mn</a>
      </p>

      <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", fontSize: "0.85rem", color: "#64748b" }}>
        <Link href="/terms">Terms of Service</Link>
        {" · "}
        <Link href="/data-deletion">Data Deletion</Link>
        {" · "}
        <Link href="/login">Sign In</Link>
      </footer>
    </main>
  );
}
