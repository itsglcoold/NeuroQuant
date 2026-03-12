import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - NeuroQuant",
  description:
    "Privacy Policy for NeuroQuant. Learn how we collect, use, and protect your personal data in compliance with GDPR.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-zinc-300 prose-li:text-zinc-300 prose-strong:text-white prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
      <header className="mb-12 border-b border-white/5 pb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: March 2026
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">1. Introduction</h2>
        <p>
          NeuroQuant (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
          is committed to protecting your privacy and personal data. This
          Privacy Policy explains how we collect, use, store, and protect your
          information when you use our AI-powered market analysis platform
          (&quot;the Service&quot;).
        </p>
        <p>
          This policy is designed to comply with the General Data Protection
          Regulation (GDPR) (EU) 2016/679 and other applicable European Union
          data protection legislation. We process personal data lawfully,
          fairly, and in a transparent manner.
        </p>
        <p>
          By using the Service, you acknowledge that you have read and
          understood this Privacy Policy.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">2. Data Controller</h2>
        <p>
          NeuroQuant acts as the data controller for the personal data
          processed through the Service. For any questions regarding data
          processing, you may contact us at:
        </p>
        <ul>
          <li>
            <strong>Email:</strong>{" "}
            <a href="mailto:privacy@neuroquant.app">
              privacy@neuroquant.app
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          3. Personal Data We Collect
        </h2>
        <p>
          We collect and process the following categories of personal data:
        </p>

        <h3 className="text-lg font-medium">3.1 Account Information</h3>
        <ul>
          <li>Email address (required for account creation and authentication)</li>
          <li>Display name (if provided)</li>
          <li>Authentication credentials (managed securely via Supabase Auth)</li>
          <li>Subscription plan and billing status</li>
        </ul>

        <h3 className="text-lg font-medium">3.2 Usage Data</h3>
        <ul>
          <li>
            AI analysis requests and the markets/assets analyzed
          </li>
          <li>
            Features used, frequency of use, and interaction patterns
          </li>
          <li>Timestamps of Service access and usage sessions</li>
          <li>
            Device type, browser type, and operating system (collected
            automatically)
          </li>
        </ul>

        <h3 className="text-lg font-medium">3.3 User-Uploaded Content</h3>
        <ul>
          <li>
            Chart screenshots and images uploaded for AI analysis
          </li>
          <li>
            Chat messages and queries submitted to the AI assistant
          </li>
        </ul>

        <h3 className="text-lg font-medium">3.4 Payment Data</h3>
        <ul>
          <li>
            Payment processing is handled entirely by Stripe. We do not store
            credit card numbers, bank account details, or other sensitive
            payment information on our servers. We retain only a Stripe customer
            identifier and subscription status.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          4. Legal Basis for Processing
        </h2>
        <p>
          Under the GDPR, we process your personal data on the following legal
          bases:
        </p>
        <ul>
          <li>
            <strong>Performance of a contract (Art. 6(1)(b)):</strong>{" "}
            Processing necessary to provide the Service to you, including
            account management, AI analysis, and subscription handling.
          </li>
          <li>
            <strong>Legitimate interests (Art. 6(1)(f)):</strong>{" "}
            Processing necessary for our legitimate interests, such as
            improving the Service, ensuring security, and preventing fraud,
            where these interests are not overridden by your fundamental rights.
          </li>
          <li>
            <strong>Consent (Art. 6(1)(a)):</strong>{" "}
            Where required, we will obtain your explicit consent before
            processing data for specific purposes such as marketing
            communications.
          </li>
          <li>
            <strong>Legal obligation (Art. 6(1)(c)):</strong>{" "}
            Processing necessary to comply with applicable legal requirements.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          5. How We Use Your Data
        </h2>
        <p>We use your personal data for the following purposes:</p>
        <ul>
          <li>
            <strong>Providing the Service:</strong> To create and manage your
            account, authenticate your identity, deliver AI-generated market
            analysis, process uploaded chart images, and manage your
            subscription.
          </li>
          <li>
            <strong>Improving the Service:</strong> To analyze usage patterns,
            identify areas for improvement, and enhance the accuracy and
            reliability of our AI models.
          </li>
          <li>
            <strong>Communication:</strong> To send essential service
            notifications, security alerts, and, where you have opted in,
            product updates.
          </li>
          <li>
            <strong>Security and fraud prevention:</strong> To detect and
            prevent unauthorized access, abuse, and fraudulent activity.
          </li>
          <li>
            <strong>Legal compliance:</strong> To comply with applicable laws,
            regulations, and legal processes.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          6. Third-Party Data Processors
        </h2>
        <p>
          We share your data with the following third-party processors, each of
          which is contractually bound to protect your data in accordance with
          GDPR requirements:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 pr-4 text-left font-semibold text-white">
                  Processor
                </th>
                <th className="py-3 pr-4 text-left font-semibold text-white">
                  Purpose
                </th>
                <th className="py-3 text-left font-semibold text-white">
                  Data Location
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-3 pr-4 text-zinc-300">Supabase</td>
                <td className="py-3 pr-4 text-zinc-300">
                  Authentication, database, and file storage
                </td>
                <td className="py-3 text-zinc-300">EU (Frankfurt, Germany)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-zinc-300">Vercel</td>
                <td className="py-3 pr-4 text-zinc-300">
                  Application hosting and content delivery
                </td>
                <td className="py-3 text-zinc-300">EU / Global CDN</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-zinc-300">Stripe</td>
                <td className="py-3 pr-4 text-zinc-300">
                  Payment processing and subscription management
                </td>
                <td className="py-3 text-zinc-300">EU / US</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-zinc-300">
                  AI Model Providers
                </td>
                <td className="py-3 pr-4 text-zinc-300">
                  AI-powered market analysis and chart interpretation
                </td>
                <td className="py-3 text-zinc-300">US / Global</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4">
          Where data is transferred outside the European Economic Area (EEA), we
          ensure appropriate safeguards are in place, such as Standard
          Contractual Clauses (SCCs) approved by the European Commission, or
          adequacy decisions.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">7. Data Retention</h2>
        <p>We retain your personal data according to the following schedule:</p>
        <ul>
          <li>
            <strong>Account data:</strong> Retained for the duration of your
            active account. Upon account deletion, your personal data will be
            erased within 30 days, except where retention is required by law.
          </li>
          <li>
            <strong>Uploaded chart images:</strong> Automatically deleted 30
            days after upload. Images are processed for analysis and are not
            retained beyond this period.
          </li>
          <li>
            <strong>AI chat history:</strong> Retained while your account is
            active. Deleted upon account deletion or upon your request.
          </li>
          <li>
            <strong>Usage logs:</strong> Retained for up to 12 months for
            service improvement and security purposes, then anonymized or
            deleted.
          </li>
          <li>
            <strong>Payment records:</strong> Retained as required by applicable
            tax and financial regulations (typically 7 years).
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          8. Your Rights Under GDPR
        </h2>
        <p>
          As a data subject under the GDPR, you have the following rights
          regarding your personal data:
        </p>
        <ul>
          <li>
            <strong>Right of access (Art. 15):</strong> You have the right to
            obtain confirmation of whether we process your personal data and to
            request a copy of that data.
          </li>
          <li>
            <strong>Right to rectification (Art. 16):</strong> You have the
            right to request correction of inaccurate personal data or
            completion of incomplete data.
          </li>
          <li>
            <strong>Right to erasure (Art. 17):</strong> You have the right to
            request deletion of your personal data (&quot;right to be
            forgotten&quot;), subject to applicable legal retention
            requirements.
          </li>
          <li>
            <strong>Right to restriction of processing (Art. 18):</strong> You
            have the right to request that we restrict the processing of your
            data under certain circumstances.
          </li>
          <li>
            <strong>Right to data portability (Art. 20):</strong> You have the
            right to receive your personal data in a structured, commonly used,
            and machine-readable format, and to transmit it to another
            controller.
          </li>
          <li>
            <strong>Right to object (Art. 21):</strong> You have the right to
            object to the processing of your personal data based on legitimate
            interests or for direct marketing purposes.
          </li>
          <li>
            <strong>Right to withdraw consent (Art. 7(3)):</strong> Where
            processing is based on your consent, you have the right to withdraw
            that consent at any time without affecting the lawfulness of prior
            processing.
          </li>
        </ul>
        <p>
          To exercise any of these rights, please contact us at{" "}
          <a href="mailto:privacy@neuroquant.app">
            privacy@neuroquant.app
          </a>
          . We will respond to your request within 30 days as required by the
          GDPR. You also have the right to lodge a complaint with a supervisory
          authority in your EU member state of residence.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">9. Cookies</h2>
        <p>
          We use minimal cookies that are strictly necessary for the operation
          of the Service:
        </p>
        <ul>
          <li>
            <strong>Session cookies:</strong> Used to maintain your
            authenticated session while using the Service. These are essential
            for the Platform to function and are automatically deleted when you
            close your browser or when your session expires.
          </li>
          <li>
            <strong>Authentication tokens:</strong> Used to securely identify
            your account session.
          </li>
        </ul>
        <p>
          We do not use advertising cookies, tracking cookies, or third-party
          analytics cookies. We do not engage in cross-site tracking or
          behavioral profiling.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">10. Data Security</h2>
        <p>
          We implement appropriate technical and organizational measures to
          protect your personal data against unauthorized access, alteration,
          disclosure, or destruction. These measures include:
        </p>
        <ul>
          <li>Encryption of data in transit using TLS/SSL.</li>
          <li>Encryption of data at rest in our database systems.</li>
          <li>
            Secure authentication via Supabase Auth with support for
            industry-standard protocols.
          </li>
          <li>Regular security assessments and access control reviews.</li>
          <li>
            Primary data storage within the European Union (Supabase EU
            Frankfurt region).
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          11. Data Breach Notification
        </h2>
        <p>
          In the event of a personal data breach that is likely to result in a
          risk to your rights and freedoms, we will:
        </p>
        <ul>
          <li>
            Notify the relevant supervisory authority within 72 hours of
            becoming aware of the breach, as required by Article 33 of the
            GDPR.
          </li>
          <li>
            Notify affected individuals without undue delay if the breach is
            likely to result in a high risk to their rights and freedoms, as
            required by Article 34 of the GDPR.
          </li>
          <li>
            Document the breach, its effects, and the remedial actions taken.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          12. No Sale of Personal Data
        </h2>
        <p>
          We do not sell, rent, lease, or trade your personal data to third
          parties for their commercial purposes. Your data is only shared with
          the third-party processors listed in Section 6, solely for the
          purposes described in this Privacy Policy.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">13. Children</h2>
        <p>
          The Service is not intended for individuals under the age of 18. We
          do not knowingly collect personal data from children. If we become
          aware that we have collected personal data from a person under 18, we
          will take steps to delete that information promptly. If you believe a
          child has provided us with personal data, please contact us at{" "}
          <a href="mailto:privacy@neuroquant.app">
            privacy@neuroquant.app
          </a>
          .
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          14. Changes to This Privacy Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time to reflect
          changes in our practices, technology, legal requirements, or other
          factors. When we make material changes, we will notify you by email
          and/or by posting a prominent notice on the Platform at least 30 days
          before the changes take effect.
        </p>
        <p>
          We encourage you to review this Privacy Policy periodically. Your
          continued use of the Service after the effective date of the revised
          policy constitutes your acknowledgment of the changes.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">15. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, wish to exercise
          your GDPR rights, or have concerns about how your data is handled,
          please contact us:
        </p>
        <ul>
          <li>
            <strong>Data Protection Inquiries:</strong>{" "}
            <a href="mailto:privacy@neuroquant.app">
              privacy@neuroquant.app
            </a>
          </li>
          <li>
            <strong>General Inquiries:</strong>{" "}
            <a href="mailto:legal@neuroquant.app">
              legal@neuroquant.app
            </a>
          </li>
        </ul>
      </section>

      <footer className="mt-12 border-t border-white/5 pt-8">
        <p className="text-sm text-zinc-500">
          This Privacy Policy should be read in conjunction with our{" "}
          <Link href="/legal/terms" className="text-blue-400 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/risk-disclosure"
            className="text-blue-400 hover:underline"
          >
            Risk Disclosure
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
