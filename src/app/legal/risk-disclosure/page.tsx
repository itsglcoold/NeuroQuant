import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Risk Disclosure - NeuroQuant",
  description:
    "Risk Disclosure for NeuroQuant. Understand the risks associated with AI-generated market analysis and trading.",
};

export default function RiskDisclosurePage() {
  return (
    <article className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
      <header className="mb-12 border-b border-border pb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Risk Disclosure
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: March 2026
        </p>
      </header>

      <div className="mb-10 rounded-lg border border-red-500/20 bg-red-500/5 p-6">
        <p className="text-red-200">
          <strong>Critical Notice:</strong> Trading and investing in financial
          markets involves significant risk, including the potential loss of
          your entire invested capital. NeuroQuant provides AI-generated
          analysis for informational and educational purposes only. This is NOT
          investment advice, financial advice, or a recommendation to buy, sell,
          or hold any financial instrument. You should carefully consider your
          financial situation and risk tolerance before engaging in any trading
          activity.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          1. Purpose and Scope of This Disclosure
        </h2>
        <p>
          This Risk Disclosure statement is provided by NeuroQuant
          (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) to ensure that
          users of our AI-powered market analysis platform (&quot;the
          Service&quot;) fully understand the risks associated with using
          AI-generated analysis for financial markets, including Gold, Silver,
          Oil, Forex currency pairs, the S&amp;P 500, and NASDAQ.
        </p>
        <p>
          You should read this Risk Disclosure in its entirety before using the
          Service. By using the Service, you acknowledge that you have read,
          understood, and accepted the risks described herein.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          2. Not Financial Advice or Recommendation
        </h2>
        <p>
          All AI-generated analysis, reports, signals, scores, and content
          provided through the Service are strictly for informational and
          educational purposes. They do not constitute:
        </p>
        <ul>
          <li>Investment advice or financial advice of any kind.</li>
          <li>
            A recommendation or solicitation to buy, sell, or hold any
            financial instrument, security, or derivative.
          </li>
          <li>
            An offer to provide investment management or advisory services.
          </li>
          <li>
            A guarantee or assurance regarding the future performance of any
            asset or market.
          </li>
        </ul>
        <p>
          We are not registered as financial advisors, investment advisors,
          broker-dealers, or in any similar capacity with any financial
          regulatory authority in any jurisdiction. We do not hold any licenses
          to provide personalized financial guidance.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          3. Risks of Trading and Investing
        </h2>
        <p>
          Trading and investing in financial markets carries significant risks
          that you should be fully aware of:
        </p>
        <ul>
          <li>
            <strong>Risk of total loss:</strong> You may lose some or all of
            your invested capital. Leveraged products such as Forex and CFDs
            carry a particularly high risk of rapid and substantial losses.
          </li>
          <li>
            <strong>Market volatility:</strong> Financial markets can
            experience sudden and extreme price movements due to economic
            events, geopolitical developments, regulatory changes, or
            unexpected circumstances.
          </li>
          <li>
            <strong>Liquidity risk:</strong> In certain market conditions, it
            may be difficult or impossible to execute trades at desired prices.
          </li>
          <li>
            <strong>Currency risk:</strong> When trading Forex or
            international assets, exchange rate fluctuations can result in
            additional gains or losses.
          </li>
          <li>
            <strong>Past performance:</strong> Historical patterns, trends,
            and past performance of any asset do not guarantee or reliably
            indicate future results. Markets are inherently unpredictable.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          4. Limitations of AI-Generated Analysis
        </h2>
        <p>
          The AI models used by NeuroQuant have significant inherent
          limitations that users must understand:
        </p>
        <ul>
          <li>
            <strong>Model limitations:</strong> AI models are trained on
            historical data and may not account for unprecedented events,
            structural market changes, or conditions not represented in their
            training data.
          </li>
          <li>
            <strong>Potential for errors:</strong> AI-generated analysis may
            contain errors, inaccuracies, misinterpretations, or
            hallucinations. Outputs are generated by machine learning
            algorithms and are not reviewed by human financial analysts.
          </li>
          <li>
            <strong>Bias and uncertainty:</strong> AI models may exhibit
            systematic biases arising from their training data, methodology,
            or architecture. These biases may lead to consistently skewed or
            unreliable analysis for certain market conditions or assets.
          </li>
          <li>
            <strong>Data quality:</strong> The accuracy of AI analysis depends
            on the quality and timeliness of the underlying market data. Market
            data feeds may be delayed, incomplete, or contain errors that
            propagate into the analysis.
          </li>
          <li>
            <strong>Chart analysis limitations:</strong> AI interpretation of
            uploaded chart images involves pattern recognition that is
            inherently subjective. The AI may misidentify patterns, draw
            incorrect conclusions, or fail to recognize relevant features.
          </li>
          <li>
            <strong>No understanding of context:</strong> AI models lack a
            genuine understanding of market fundamentals, macroeconomic
            conditions, or the broader context that human analysts consider.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          5. Multi-AI Consensus System
        </h2>
        <p>
          NeuroQuant uses a multi-AI consensus system that combines the
          outputs of multiple independent AI models to generate analysis. It is
          important to understand that:
        </p>
        <ul>
          <li>
            The consensus system does NOT make the analysis more accurate or
            more reliable than any individual model. Multiple models can
            simultaneously produce incorrect conclusions.
          </li>
          <li>
            Agreement between multiple AI models does not validate the
            correctness of the analysis. Models trained on similar data may
            share the same blind spots and biases.
          </li>
          <li>
            The consensus mechanism is a proprietary methodology and should
            not be interpreted as a form of peer review or expert validation.
          </li>
          <li>
            Consensus scores, confidence levels, and agreement metrics are
            internal measures of model alignment and do not represent
            probabilities of future market outcomes.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          6. Market Data Accuracy
        </h2>
        <p>
          The market data displayed and used by the Service may be:
        </p>
        <ul>
          <li>
            Delayed by varying intervals depending on the data source and
            asset class. Real-time data availability depends on your
            subscription plan and the data provider.
          </li>
          <li>
            Subject to errors, omissions, or inconsistencies in the data feed.
          </li>
          <li>
            Incomplete or unavailable during periods of extreme market
            volatility, technical outages, or data provider disruptions.
          </li>
        </ul>
        <p>
          We make no representation that market data provided through the
          Service is accurate, complete, or current. You should always verify
          market data independently from authoritative sources before making
          trading decisions.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          7. EU AI Act Transparency Disclosure
        </h2>
        <p>
          In accordance with the European Union Artificial Intelligence Act
          (Regulation (EU) 2024/1689), we provide the following transparency
          information:
        </p>
        <ul>
          <li>
            <strong>AI system classification:</strong> NeuroQuant is an
            AI-powered tool that generates market analysis using artificial
            intelligence models. The system processes market data, technical
            indicators, and user-uploaded chart images to produce analytical
            outputs.
          </li>
          <li>
            <strong>AI-generated content:</strong> All analysis, scores,
            signals, and textual outputs produced by the Service are generated
            by artificial intelligence. This content is clearly identified as
            AI-generated and should be treated as such.
          </li>
          <li>
            <strong>Intended purpose:</strong> The system is designed to
            provide informational and educational market analysis. It is not
            designed or intended to replace professional financial advice or
            to make autonomous trading decisions.
          </li>
          <li>
            <strong>Human oversight:</strong> Users are expected to exercise
            their own judgment when reviewing AI-generated analysis. The
            system is designed as a decision-support tool, not a
            decision-making tool.
          </li>
          <li>
            <strong>Limitations and risks:</strong> As described throughout
            this document, the AI system has inherent limitations including
            potential inaccuracies, biases, and inability to predict future
            market behavior. Users should not rely solely on AI-generated
            outputs for financial decisions.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          8. Seek Professional Advice
        </h2>
        <p>
          Before making any investment or trading decision, you should:
        </p>
        <ul>
          <li>
            Consult with a qualified and licensed financial advisor,
            investment professional, or tax advisor who can provide
            personalized guidance appropriate to your specific financial
            situation, goals, and risk tolerance.
          </li>
          <li>
            Conduct your own thorough and independent research and analysis.
          </li>
          <li>
            Consider whether any investment or trading activity is suitable
            for your financial situation, experience level, and investment
            objectives.
          </li>
          <li>
            Never invest or trade with money you cannot afford to lose.
          </li>
          <li>
            Be aware of and comply with all applicable laws and regulations
            governing trading and investing in your jurisdiction.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          9. Limitation of Liability
        </h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEUROQUANT
          SHALL NOT BE LIABLE FOR ANY FINANCIAL LOSSES, TRADING LOSSES, LOST
          PROFITS, OR ANY OTHER DAMAGES ARISING FROM OR RELATED TO:
        </p>
        <ul>
          <li>
            Your use of or reliance on AI-generated analysis provided by the
            Service.
          </li>
          <li>
            Any trading or investment decision made based on information
            obtained through the Service.
          </li>
          <li>
            Inaccuracies, errors, or omissions in AI-generated analysis or
            market data.
          </li>
          <li>
            Delays, interruptions, or failures in the Service or data feeds.
          </li>
          <li>
            Any interpretation of AI-generated analysis as financial advice
            or investment recommendations.
          </li>
        </ul>
        <p>
          You use the Service entirely at your own risk. You are solely
          responsible for any and all trading and investment decisions you
          make, regardless of whether those decisions were informed by
          AI-generated analysis from the Service.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">
          10. Regulatory Status
        </h2>
        <p>
          NeuroQuant is a technology company providing AI-powered
          informational tools. We are not:
        </p>
        <ul>
          <li>
            A registered financial advisor, investment advisor, or fiduciary.
          </li>
          <li>
            A licensed broker-dealer, securities firm, or trading platform.
          </li>
          <li>
            Regulated by any financial supervisory authority as a financial
            services provider.
          </li>
          <li>
            Authorized to manage, invest, or trade financial assets on behalf
            of any person or entity.
          </li>
        </ul>
        <p>
          The Service does not facilitate, execute, or intermediate any
          financial transactions. We do not hold or manage client funds or
          assets.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">11. Acknowledgment</h2>
        <p>By using NeuroQuant, you acknowledge and confirm that:</p>
        <ul>
          <li>
            You have read, understood, and accepted this Risk Disclosure in
            its entirety.
          </li>
          <li>
            You understand that AI-generated analysis is not financial advice
            and carries significant limitations.
          </li>
          <li>
            You understand that trading and investing involves significant
            risk, including the potential for total loss of capital.
          </li>
          <li>
            You are solely responsible for your own trading and investment
            decisions.
          </li>
          <li>
            You will not hold NeuroQuant liable for any financial
            losses arising from the use of the Service.
          </li>
          <li>
            You are at least 18 years of age and are legally permitted to
            engage in trading activity in your jurisdiction.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold">12. Contact Information</h2>
        <p>
          If you have any questions about this Risk Disclosure or need further
          clarification, please contact us at:
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

      <footer className="mt-12 border-t border-border pt-8">
        <p className="text-sm text-zinc-500">
          This Risk Disclosure should be read in conjunction with our{" "}
          <Link href="/legal/terms" className="text-blue-400 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            className="text-blue-400 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
