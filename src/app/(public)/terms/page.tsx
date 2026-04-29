import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — MarTech",
  description: "Terms and conditions for using the MarTech platform."
};

export default function TermsOfServicePage() {
  const updated = "March 22, 2026";

  return (
    <main style={{ padding: "2rem", maxWidth: 780, margin: "0 auto", lineHeight: 1.7 }}>
      <nav style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        <Link href="/">← Home</Link>
        {" · "}
        <Link href="/privacy">Privacy Policy</Link>
        {" · "}
        <Link href="/data-deletion">Data Deletion</Link>
      </nav>

      <h1>Terms of Service</h1>
      <p style={{ color: "#64748b" }}>Last updated: {updated}</p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of the MarTech platform (&quot;Service&quot;)
        operated by Brand On Creative House LLC, a company registered in Mongolia (&quot;we&quot;, &quot;us&quot;). By accessing or using the Service, you agree to
        be bound by these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and have the legal authority to enter into these Terms. If you are using the
        Service on behalf of a business, you represent that you have the authority to bind that business.
      </p>

      <h2>2. Account Registration</h2>
      <ul>
        <li>You must provide a valid email address to create an account.</li>
        <li>You are responsible for maintaining the security of your account.</li>
        <li>One organization per user account is permitted.</li>
        <li>You must not share your login credentials with others.</li>
      </ul>

      <h2>3. Permitted Use</h2>
      <p>You may use the Service to:</p>
      <ul>
        <li>Connect and monitor your own Facebook Pages that you manage</li>
        <li>View analytics, insights, and AI-generated recommendations</li>
        <li>Manage your subscription and billing</li>
      </ul>

      <h2>4. Prohibited Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Access data belonging to other users or organizations</li>
        <li>Use the Service to scrape, harvest, or collect data for purposes other than your own analytics</li>
        <li>Attempt to bypass security measures, authentication, or authorization controls</li>
        <li>Use the Service for any illegal purpose or in violation of Meta&apos;s Platform Terms</li>
        <li>Resell, redistribute, or sublicense access to the Service</li>
        <li>Interfere with or disrupt the Service or its infrastructure</li>
      </ul>

      <h2>5. Facebook / Meta Integration</h2>
      <p>
        By connecting your Facebook account, you authorize us to access your Page data as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>. You acknowledge that:
      </p>
      <ul>
        <li>You must be an administrator of the Facebook Pages you connect</li>
        <li>We access data through Meta&apos;s official Graph API in compliance with their Platform Terms</li>
        <li>You may revoke access at any time through Facebook Settings or our platform</li>
        <li>Service availability depends on Meta&apos;s API availability and policies</li>
      </ul>

      <h2>6. Subscriptions and Payments</h2>
      <ul>
        <li>
          The Service offers paid subscription plans. Pricing is displayed on our{" "}
          <Link href="/pricing">Pricing</Link> page.
        </li>
        <li>Payments are processed via QPay. You agree to QPay&apos;s terms when making a payment.</li>
        <li>Subscriptions are billed monthly. Prices are in MNT (Mongolian Tugrik) or USD as displayed.</li>
        <li>
          We reserve the right to change pricing with 30 days&apos; notice. Existing subscriptions are honored until
          the end of the current billing period.
        </li>
        <li>Refunds are handled on a case-by-case basis. Contact support for refund requests.</li>
      </ul>

      <h2>7. AI-Generated Content</h2>
      <p>
        The Service provides AI-generated insights and recommendations based on your Page metrics. This content is for
        informational purposes only. We do not guarantee the accuracy, completeness, or suitability of AI-generated
        recommendations. You are solely responsible for decisions made based on these insights.
      </p>

      <h2>8. Data Ownership</h2>
      <ul>
        <li><strong>Your data</strong>: You retain ownership of all data you provide or that is collected from your Facebook Pages.</li>
        <li><strong>Our service</strong>: We retain ownership of the Service, its design, code, and proprietary algorithms.</li>
        <li><strong>AI outputs</strong>: AI-generated reports and recommendations are provided as part of the Service and may be used by you without restriction.</li>
      </ul>

      <h2>9. Service Availability</h2>
      <p>
        We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be
        temporarily unavailable for maintenance, updates, or due to factors beyond our control. We are not liable for
        any loss resulting from service interruptions.
      </p>

      <h2>10. Account Termination</h2>
      <ul>
        <li>You may close your account at any time by requesting data deletion.</li>
        <li>We may suspend or terminate accounts that violate these Terms.</li>
        <li>Upon termination, your data will be deleted in accordance with our <Link href="/privacy">Privacy Policy</Link>.</li>
      </ul>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Brand On Creative House LLC shall not be liable for any indirect, incidental,
        special, consequential, or punitive damages, including loss of profits, data, or business opportunities,
        arising from your use of the Service.
      </p>

      <h2>12. Disclaimer of Warranties</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either
        express or implied, including but not limited to implied warranties of merchantability, fitness for a particular
        purpose, and non-infringement.
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may modify these Terms at any time. We will notify users of material changes via email or an in-app notice.
        Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2>14. Governing Law</h2>
      <p>
        These Terms are governed by the laws of Mongolia. Any disputes shall be resolved in the courts of Ulaanbaatar,
        Mongolia.
      </p>

      <h2>15. Contact</h2>
      <p>
        For questions about these Terms, contact us at:{" "}
        <a href="mailto:support@martech.mn">support@martech.mn</a>
      </p>

      <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", fontSize: "0.85rem", color: "#64748b" }}>
        <Link href="/privacy">Privacy Policy</Link>
        {" · "}
        <Link href="/data-deletion">Data Deletion</Link>
        {" · "}
        <Link href="/login">Sign In</Link>
      </footer>
    </main>
  );
}
