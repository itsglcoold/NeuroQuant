# Disclaimer Gate (Risk Disclosure Acceptance Wall)

## Overview
A full-screen overlay modal that appears when users first access the dashboard. Users cannot proceed without reading and accepting the risk warnings. Acceptance is stored in localStorage and expires after 30 days, requiring re-acceptance.

## Trigger
- Appears on first visit to any `/dashboard/*` page
- Re-appears after 30 days since last acceptance
- Users can clear acceptance via browser DevTools (localStorage key: `disclaimer_accepted`)

## Storage
- Currently stored in **localStorage** (client-side only)
- Key: `disclaimer_accepted`
- Value: Unix timestamp of acceptance
- Expiry: 30 days
- **Note:** Not yet stored in Supabase database — planned for when Stripe integration is added

---

## Title
**Risk Disclosure & Terms of Use**

*Please read the following risk warnings carefully before proceeding.*

---

## Risk Warnings Displayed

### Warning 1
AI-generated analysis is for educational and informational purposes ONLY. It should not be relied upon as the sole basis for any financial decision.

### Warning 2
This is NOT investment advice, financial advice, trading advice, or a recommendation to buy, sell, or hold any security or financial instrument.

### Warning 3
AI models have inherent limitations and may produce inaccurate, incomplete, or misleading results. Outputs should always be independently verified.

### Warning 4
Trading and investing in financial markets involves significant risk of loss, including the potential for total loss of your invested capital.

### Warning 5
Past performance, whether real or simulated, does not guarantee or indicate future results. Market conditions can change rapidly and unpredictably.

### Warning 6
You should consult a qualified, licensed financial advisor before making any investment decisions. Do not act on AI-generated analysis alone.

---

## Legal Links
By continuing, you agree to our:
- [Terms of Service](/legal/terms)
- [Privacy Policy](/legal/privacy)
- [Risk Disclosure](/legal/risk-disclosure)

---

## Checkbox (required)
> I have read and understand the risks. I acknowledge that this tool provides educational analysis only and is not financial advice.

## Button (disabled until checkbox is checked)
**Continue to Dashboard**

---

## Technical Details
- Component: `src/components/dashboard/DisclaimerGate.tsx`
- Type: Client component (`"use client"`)
- UI: Full-screen overlay with dark background blur (`bg-zinc-950/95 backdrop-blur-sm`)
- Max width: 2xl (672px)
- Scrollable warning area: max height 40vh
- Button: Gradient blue-to-cyan, disabled state at 30% opacity
