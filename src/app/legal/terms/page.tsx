import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - NeuroQuant",
  description:
    "Terms of Service for NeuroQuant. Read our terms and conditions for using our AI-powered market analysis platform.",
};

export default function TermsOfServicePage() {
  return (
    <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-zinc-300 prose-li:text-zinc-300 prose-strong:text-white prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
      <header className="mb-12 border-b border-white/5 pb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: March 2026
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
        <p>
          By accessing or using NeuroQuant (&quot;the Service&quot;,
          &quot;the Platform&quot;), operated by NeuroQuant
          (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be
          bound by these Terms of Service (&quot;Terms&quot;). If you do not
          agree to these Terms, you must not use the Service.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and
          NeuroQuant governing your use of the Platform, including all
          features, tools, AI-generated analysis, and associated content.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          2. Nature of the Service &mdash; Not Financial Advice
        </h2>
        <p>
          NeuroQuant is an educational and informational tool that uses
          artificial intelligence to generate market analysis for assets
          including Gold, Silver, Oil, Forex currency pairs, the S&amp;P 500,
          and NASDAQ.
        </p>
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-amber-200">
          <strong>Important:</strong> The Service does NOT provide financial
          advice, investment recommendations, or trading signals. All
          AI-generated analysis is for informational and educational purposes
          only. You should not interpret any content produced by the Service as a
          recommendation to buy, sell, or hold any financial instrument.
        </p>
        <p>
          We are not registered as financial advisors, investment advisors,
          broker-dealers, or in any similar capacity with any financial
          regulatory authority. Nothing on this Platform should be construed as
          an offer, solicitation, or recommendation to engage in any investment
          activity.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">3. Eligibility</h2>
        <p>
          You must be at least 18 years of age to use the Service. By creating
          an account, you represent and warrant that you are at least 18 years
          old and have the legal capacity to enter into these Terms. If you are
          using the Service on behalf of an organization, you represent that you
          have the authority to bind that organization to these Terms.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">4. User Accounts</h2>
        <p>
          To access certain features of the Service, you must create an account.
          You are responsible for:
        </p>
        <ul>
          <li>
            Maintaining the confidentiality of your account credentials.
          </li>
          <li>All activity that occurs under your account.</li>
          <li>
            Providing accurate, current, and complete information during
            registration.
          </li>
          <li>
            Notifying us immediately of any unauthorized use of your account.
          </li>
        </ul>
        <p>
          We reserve the right to suspend or terminate your account at any time,
          with or without cause, and with or without notice, including but not
          limited to situations where you violate these Terms, engage in abusive
          behavior, or use the Service for unlawful purposes.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">5. User Responsibilities</h2>
        <p>
          You are solely responsible for your own investment and trading
          decisions. By using the Service, you acknowledge and agree that:
        </p>
        <ul>
          <li>
            AI-generated analysis has inherent limitations and may be
            inaccurate, incomplete, or outdated.
          </li>
          <li>
            The AI models used by the Platform may produce errors, exhibit
            biases, or generate conflicting conclusions.
          </li>
          <li>
            Past performance of any asset or analysis pattern does not guarantee
            future results.
          </li>
          <li>
            You will conduct your own independent research before making any
            financial decision.
          </li>
          <li>
            You will consult qualified financial professionals where
            appropriate.
          </li>
          <li>
            You will not rely solely on AI-generated content from this Platform
            for any trading or investment decision.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">6. AI-Generated Content</h2>
        <p>
          The Service uses multiple AI models to analyze market data, including
          technical indicators, price patterns, and uploaded chart images. You
          acknowledge that:
        </p>
        <ul>
          <li>
            AI-generated analysis is produced by machine learning models and is
            not reviewed by human financial analysts before being presented to
            you.
          </li>
          <li>
            The multi-AI consensus system combines outputs from multiple models,
            but this aggregation does not guarantee greater accuracy or
            reliability.
          </li>
          <li>
            Market data used by the Service may be delayed, incomplete, or
            contain errors.
          </li>
          <li>
            We make no representations or warranties regarding the accuracy,
            completeness, timeliness, or reliability of any AI-generated
            content.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">7. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>
            Violate any applicable laws, regulations, or third-party rights.
          </li>
          <li>
            Redistribute, resell, or commercially exploit AI-generated analysis
            without our prior written consent.
          </li>
          <li>
            Attempt to reverse-engineer, decompile, or extract the underlying AI
            models or algorithms.
          </li>
          <li>
            Use automated tools, bots, or scrapers to access the Service beyond
            the scope of the API access provided under your plan.
          </li>
          <li>
            Upload malicious content, malware, or content that infringes on
            intellectual property rights through the chart upload feature.
          </li>
          <li>
            Misrepresent AI-generated analysis as human-produced professional
            financial advice.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          8. Subscriptions, Payments, and Refunds
        </h2>
        <p>
          NeuroQuant offers both free and paid subscription plans.
          Payment for paid plans is processed through Stripe and is billed on a
          recurring monthly basis.
        </p>
        <ul>
          <li>
            <strong>Free Trial:</strong> Paid plans include a 7-day free trial.
            You will not be charged during the trial period.
          </li>
          <li>
            <strong>Billing:</strong> After the trial period, your subscription
            will automatically renew and your payment method will be charged at
            the beginning of each billing cycle.
          </li>
          <li>
            <strong>Cancellation:</strong> You may cancel your subscription at
            any time. Upon cancellation, you will receive a pro-rated refund for
            the unused portion of your current billing period.
          </li>
          <li>
            <strong>Refunds:</strong> Refunds are generally not available once
            the Service has been used during a billing period. Exceptions may be
            made at our sole discretion.
          </li>
          <li>
            <strong>Price Changes:</strong> We reserve the right to change
            subscription prices. You will be notified at least 30 days in
            advance of any price changes affecting your current plan.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">9. Intellectual Property</h2>
        <p>
          All content, features, functionality, design elements, AI models,
          algorithms, and underlying technology of the Service are and remain the
          exclusive property of NeuroQuant and its licensors. This
          includes, but is not limited to:
        </p>
        <ul>
          <li>The NeuroQuant name, logo, and branding.</li>
          <li>AI-generated analysis, reports, and visualizations.</li>
          <li>The Platform&apos;s user interface and design.</li>
          <li>Proprietary algorithms and AI model configurations.</li>
        </ul>
        <p>
          You retain ownership of any chart images you upload to the Service.
          By uploading content, you grant us a limited, non-exclusive license to
          process and analyze that content solely for the purpose of providing
          the Service to you.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          10. Disclaimer of Warranties
        </h2>
        <p>
          THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
          IMPLIED, STATUTORY, OR OTHERWISE. TO THE FULLEST EXTENT PERMITTED BY
          APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED
          TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, NON-INFRINGEMENT, AND ACCURACY.
        </p>
        <p>
          We do not warrant that the Service will be uninterrupted, error-free,
          secure, or free of viruses or other harmful components. We do not
          warrant the accuracy, reliability, or completeness of any
          AI-generated analysis or market data provided through the Service.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          11. Limitation of Liability
        </h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEUROQUANT
          AND ITS DIRECTORS, OFFICERS, EMPLOYEES, AFFILIATES, AND AGENTS SHALL
          NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
        </p>
        <ul>
          <li>
            Financial losses, lost profits, or lost trading opportunities
            resulting from the use of or reliance on AI-generated analysis.
          </li>
          <li>
            Losses arising from trading decisions made based on the
            Service&apos;s output.
          </li>
          <li>
            Losses resulting from inaccurate, delayed, or incomplete market
            data.
          </li>
          <li>
            Damages arising from unauthorized access to your account.
          </li>
          <li>
            Any interruption or cessation of the Service.
          </li>
        </ul>
        <p>
          IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING
          FROM OR RELATED TO THE SERVICE EXCEED THE AMOUNT YOU HAVE PAID US IN
          THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">12. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless NeuroQuant, its
          officers, directors, employees, and agents from and against any
          claims, liabilities, damages, losses, and expenses arising from your
          use of the Service, your violation of these Terms, or your violation
          of any rights of a third party.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          13. Governing Law and Jurisdiction
        </h2>
        <p>
          These Terms shall be governed by and construed in accordance with the
          laws of the Netherlands and applicable European Union regulations. Any
          disputes arising from or relating to these Terms or the Service shall
          be subject to the exclusive jurisdiction of the courts of the
          Netherlands.
        </p>
        <p>
          If you are a consumer within the European Union, you may also have
          rights under mandatory consumer protection laws of your country of
          residence. Nothing in these Terms affects your statutory rights as a
          consumer under applicable EU law.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">14. Changes to These Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. When we make
          material changes, we will notify you by email to the address
          associated with your account and/or by posting a prominent notice on
          the Platform at least 30 days before the changes take effect.
        </p>
        <p>
          Your continued use of the Service after the effective date of the
          revised Terms constitutes your acceptance of the changes. If you do
          not agree with the updated Terms, you must stop using the Service and
          close your account.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">15. Severability</h2>
        <p>
          If any provision of these Terms is held to be invalid, illegal, or
          unenforceable, the remaining provisions shall continue in full force
          and effect. The invalid provision shall be modified to the minimum
          extent necessary to make it valid and enforceable.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">16. Contact Information</h2>
        <p>
          If you have any questions about these Terms of Service, please contact
          us at:
        </p>
        <ul>
          <li>
            <strong>Email:</strong>{" "}
            <a href="mailto:legal@neuroquant.app">
              legal@neuroquant.app
            </a>
          </li>
        </ul>
      </section>

      <footer className="mt-12 border-t border-white/5 pt-8">
        <p className="text-sm text-zinc-500">
          By using NeuroQuant, you acknowledge that you have read,
          understood, and agree to these Terms of Service. Please also review
          our{" "}
          <Link href="/legal/privacy" className="text-blue-400 hover:underline">
            Privacy Policy
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
