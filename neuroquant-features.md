# NeuroQuant — Complete Feature Overview
> AI-powered market analysis platform | Version: March 2026 (sessie 2026-03-26) | Stack: Next.js 15.5 + Supabase + Cloudflare Pages

---

## 1. Platform Summary

NeuroQuant is a web-based trading analysis assistant that combines three AI models into a consensus engine. It supports 25+ global markets (Forex, Metals, Energy, Indices), a paper trading simulator, chart upload with pattern recognition, daily market research, economic calendar, market news, and an AI chat.

**Target users:** Retail traders (beginner to advanced) who want AI-powered insights without needing to be data scientists.

---

## 2. Subscription Tiers

| Feature | Free | Pro ($19.99/mo) | Premium ($49.99/mo) |
|---|---|---|---|
| AI analyses/day | 3 | 50 | Unlimited |
| Markets | 5 | All 25+ | All 25+ |
| AI models | 1 (Alpha only) | 3 (Triple consensus) | 3 (Triple consensus) |
| Chart upload | ✗ | ✓ | ✓ |
| AI Market Research | ✗ | ✓ | ✓ |
| Auto-fill SL/TP | ✗ | ✓ | ✓ |
| Simulator trades/day | 3 | 50 | Unlimited |
| AI Chat | ✓ | ✓ | ✓ |
| Data refresh | 60s | 30s | 15s |
| Historical reports | ✗ | ✗ | Planned |
| API access | ✗ | ✗ | Planned |

---

## 3. Triple-AI Consensus Engine

The core feature of the platform. Three independent AI models analyze the same market data and their outputs are merged into a single consensus.

### Models
| Model | Name in App | Provider | Weight | Specialty |
|---|---|---|---|---|
| DeepSeek | Analyst Alpha | DeepSeek API | 40% | Quantitative / Technical indicators |
| Qwen | Analyst Beta | Alibaba DashScope | 40% | Visual patterns / Chart structure |
| Claude | Analyst Gamma | Anthropic | 20% | Macro / Fundamental / Cross-market |

### Consensus Output
- **Direction:** Bullish / Bearish / Neutral
- **Score:** -100 to +100 (weighted sentiment)
- **Agreement Level:** High / Medium / Low
- **Probability Alignment:** % of models agreeing
- **Sentiment Label:** e.g. "Moderate Bullish", "Strong Bearish"
- **Merged Key Levels:** Support & Resistance (filtered: support < price, resistance > price)
- **Summary:** Narrative combining all three views

### Analysis Inputs
- 30–60 OHLC candlestick bars (interval depends on timeframe)
- Technical indicators: RSI, MACD, SMA20, SMA50, Bollinger Bands
- Indicator interval: 1h for short timeframes (1m/5m/15m), 1day for swing (4h/1d)
- Correct indicator interval per timeframe (recent fix — was always 1day before)

### Streaming Protocol
Analysis results stream via SSE (Server-Sent Events) with events:
`status` → `market_data` → `analyst_alpha` → `analyst_beta` → `analyst_gamma` → `consensus`

### Timeouts
- 25s per analyst
- Graceful degradation: if one AI times out, consensus still formed from remaining results

---

## 4. Markets (25+)

| Category | Symbols |
|---|---|
| Metals | XAU/USD (Gold), XAG/USD (Silver) |
| Energy | CL (Crude Oil) |
| Indices | DXY (Dollar Index), SPX (S&P 500), IXIC (NASDAQ) |
| Forex | EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, NZD/USD, USD/CAD, EUR/JPY, GBP/JPY, AUD/JPY, NZD/JPY, CAD/JPY, EUR/GBP, GBP/AUD, GBP/NZD, GBP/CAD, GBP/CHF, AUD/CAD, AUD/CHF, AUD/NZD, EUR/AUD, NZD/CAD |

**Free tier:** Limited to 5 markets (Gold, EUR/USD, S&P 500, NASDAQ, Oil)

---

## 5. Real-Time Pricing

- **Primary:** EODHD WebSocket (`wss://ws.eodhistoricaldata.com/ws/forex`) for Forex & Metals
- **Fallback:** REST polling via `/api/market-data` for Indices & Energy (no WS available)
- **Displayed:** Price, 24h change ($), 24h change (%), High/Low/Open/Prev Close
- **Latency indicator:** < 500ms green, < 1500ms amber, > 1500ms orange
- **Session tracker:** Shows which trading sessions are currently open (Sydney / Tokyo / London / New York)

---

## 6. Paper Trading Simulator

A virtual trading environment with a $10,000 starting balance. No real money involved.

### Opening a Trade
- Starts from any market detail page
- Direction: Long (Buy) or Short (Sell)
- Entry price: current live market price (locked)
- Stop-Loss and Take-Profit: manual entry or auto-fill (Pro+)

### Auto-Fill SL/TP (Pro+)
- **SL:** Placed just beyond the nearest (most recently tested) support/resistance level, or 1.5× ATR from entry — whichever is further (avoids noise-triggered stops)
- **TP:** Uses the farthest resistance/support that achieves the minimum regime R:R; if no level is far enough, TP is calculated directly
- **Minimum R:R:** Dynamic — 1:3 in trending markets (ADX > 25), 1:2 otherwise

### ATR-Based SL Validation
- ATR (Average True Range, 14-period) is calculated from the live timeSeries data passed via SSE
- **SL too tight** fires when SL distance < 0.5× ATR (more meaningful than a fixed percentage)
- Falls back to percentage thresholds (scalp 0.3%, intraday 0.5%, swing 1.0%) if ATR data is unavailable

### Risk Score (1–10)
Displayed in the simulator widget before opening a trade. Combines three factors:
- **R:R ratio** (up to ±3 pts): ≥3:1 adds +3, ≥2:1 adds +2, ≥1.5:1 adds +1, <1:1 subtracts 2
- **AI agreement level** (up to ±2 pts): high +2, medium +1, low −1
- **SL breathing room** (ATR-based, ±1 pt): > 1× ATR +1, < 0.5× ATR −1
- **Grade labels:** 8–10 = Excellent (green), 6–7 = Good (blue), 4–5 = Moderate (amber), 1–3 = Poor (red)
- Shown with plain English explanation (e.g. "Solid R:R with strong AI agreement")

### Warnings Shown Before Opening
- **R:R below 1:2** — TP less than 2× SL distance
- **SL too tight** — ATR-based (primary) or percentage fallback
- **Low analyst agreement** — Only fires when agreementLevel === "low" (analysts disagree on direction)
- **Trading against consensus** — If user picks opposite direction to AI recommendation
- **Short timeframe warning** — Suggests switching to 15m for better level quality
- **Manual override warning** — Orange badge when user has manually changed SL or TP after auto-fill

### Auto-Close (Cron)
- External cron hits `/api/trades/check` every minute
- Compares live price to SL/TP
- Long: closes if price ≤ SL or ≥ TP
- Short: closes if price ≥ SL or ≤ TP
- P&L calculated as % from entry

### Stats Tracked
- Total trades, Win count, Loss count, Break-even count
- Win rate (accuracy %)
- Total P&L (%), Virtual balance ($)
- Active open trades count
- Full trade history with Entry / SL / TP / Close prices + AI snapshot at open

### Limits
- Free: 3 trades/day
- Pro: 50 trades/day
- Premium: Unlimited
- Reset button: clears all trades, restarts at $10,000

### Trade Journal (AI Post-Trade Review)
- After a trade closes, each card in Trade History shows an **AI Review** button
- Clicking it calls `/api/journal` (Edge, DeepSeek) which generates a 3-sentence beginner-friendly review
- Review is cached in `trade_journal` Supabase table — each trade is only reviewed once
- Review considers: direction, entry/close prices, result (win/loss/BE), whether SL was hit, holding time
- Expandable/collapsable panel with color-coded styling (green = win, red = loss)

### Onboarding Tour (driver.js)
- Auto-starts on first visit (1.2s delay after page load)
- 5-step guided tour: Run Analysis → AI Consensus → Simulator Widget → SL/TP → Open Trade
- Persistent "Tour" button always visible for manual replay
- Completion stored in localStorage (`nq_tour_completed`)
- Steps skip gracefully if element not present in DOM

---

## 7. Chart Upload & Image Analysis

- **Upload:** Drag-drop or file browse (PNG/JPG/WebP, max 5MB)
- **AI Model:** Qwen vision (qwen3.5-plus multimodal)
- **Pro+ only**

### What the AI Detects
- Market symbol (e.g. "XAUUSD" → XAU/USD)
- Timeframe (e.g. "1H", "Daily")
- Trading style (scalping / daytrading / swing)
- Chart patterns: Head-and-shoulders, Double top/bottom, Triangles, Flags, Wedges, Pennants, Fibonacci
- Support & Resistance levels (extracted from chart)
- Visible indicators (RSI, MACD, Moving Averages, Bollinger Bands)
- Direction (Bullish / Bearish / Neutral) + Confidence %

### Output
- Scalp Outlook (for scalping/daytrading styles)
- Swing Outlook (for swing styles)
- Detailed written analysis

---

## 8. AI Market Research (Daily Suggestions)

- Scans all 25+ markets to find best current opportunities
- **Groups results by trading style:** Scalping / Daytrading / Swing Trading
- **Each suggestion shows:** Symbol, Direction, Confidence %, Sentiment label, Probability alignment, Key level, Reasoning, Timeframe
- **Cache:** 30 min fresh, 4 hours stale (serves stale if refresh fails)
- **Pro+ only**

---

## 9. AI Chat

- Full conversation interface at `/dashboard/chat`
- Powered by DeepSeek (cost-optimized for chat)
- Streaming responses with markdown rendering
- Focused on market education and analysis questions
- Session-based history (resets on page reload)
- All tiers

---

## 10. Economic Calendar

- Events sourced from external calendar API
- **Filters:** Date range, Country (US/EU/UK/JP/CH/AU/NZ/CA), Impact level (High/Medium/Low), Asset (Oil/Gold/Silver), Keyword search
- **Date ranges:** Today, Tomorrow, This Week, Next Week, This Month, Custom
- **Displayed:** Event name, impact level, country flag, forecast, previous value, actual value, release time

---

## 11. News Feed

- Market news by category: All / Metals / Energy / Forex / Indices
- Up to 30 articles per fetch
- Filter by keyword, source, symbol
- Shows: title, source, relative publish time, description
- External links to full articles

---

## 12. Authentication

- **Login methods:** Magic link (email OTP) + Google OAuth
- **Backend:** Supabase Auth (cookie-based sessions)
- **On first login:** Auto-creates `profiles` row with free tier
- **Tier check:** Always verified from Supabase DB on mount (not just localStorage)

---

## 13. Pages

| Page | Access | Description |
|---|---|---|
| `/` | Public | Landing page with features, markets preview, pricing overview |
| `/pricing` | Public | Tier comparison, FAQ |
| `/auth/login` | Public | Email magic link + Google OAuth |
| `/dashboard` | Protected | Market overview with live price cards, session status |
| `/dashboard/market/[symbol]` | Protected | Deep market page: chart, analysis, simulator widget |
| `/dashboard/upload` | Pro+ | Chart image upload + AI analysis |
| `/dashboard/chat` | All tiers | AI chat interface |
| `/dashboard/simulator` | All tiers | Full trade history, stats, active trades |
| `/dashboard/news` | All tiers | Market news feed |
| `/dashboard/calendar` | All tiers | Economic calendar |
| `/dashboard/settings` | Protected | Account info, tier badge, sign out |
| `/legal/terms` | Public | Terms of Service |
| `/legal/privacy` | Public | Privacy Policy |
| `/legal/risk-disclosure` | Public | Risk Disclosure |

---

## 14. Technical Infrastructure

| Layer | Technology |
|---|---|
| Frontend | Next.js 15.5, React, Tailwind CSS, Shadcn/UI |
| Backend | Next.js API routes (Edge Runtime / Cloudflare Workers) |
| Database | Supabase (PostgreSQL) — profiles, paper_trades, trade_journal |
| Auth | Supabase Auth (magic link + Google OAuth) |
| AI — Technical | DeepSeek API (deepseek-chat) |
| AI — Chart/Visual | Alibaba DashScope (qwen3.5-plus, qwen-plus) |
| AI — Strategic | Anthropic Claude (claude-sonnet-4) |
| Market data | EODHD (WebSocket + REST) |
| Payments | Stripe (checkout, customer portal, webhooks) |
| Email | Resend SMTP (smtp.resend.com:465) |
| Deployment | Cloudflare Pages via @cloudflare/next-on-pages |
| Caching | Cloudflare Cache API (suggestions: 30min/4h) |

---

## 15. Known Limitations / Current State

- Data refresh rates (30s Pro / 15s Premium) are set but real-time WebSocket upgrades not fully rolled out yet
- Historical reports (Premium) — planned, not yet built
- API access (Premium) — planned, not yet built
- Chat history resets on page reload (no persistence)
- Simulator P&L is percentage-based, not dollar-position-sized (no leverage/lot size)
- Cron job for auto-closing trades requires external trigger (not self-scheduling)
- Single-language UI (English only)

---

## 16. What's Working Well

- Triple-AI consensus with weighted scoring
- Real-time WebSocket prices for 20+ forex/metal pairs
- Streaming analysis with per-analyst progress
- Paper simulator with SL/TP auto-close and ATR-based validation
- Risk Score (1–10) with plain English explanation
- Trade Journal with AI-generated post-trade review (DeepSeek, cached)
- Beginner onboarding tour (driver.js, 5 steps, auto-start + replay)
- Feature gating per tier (graceful upgrade prompts)
- Edge runtime for low-latency API responses
- Disclaimer system and legal pages

---

## 17. Phase 1 Improvements (completed March 2026)

Based on feedback from DeepSeek / Gemini / Grok AI consultants:

| # | Improvement | Status |
|---|---|---|
| 1 | Risk Score (1–10) with plain English explanation | ✅ Done |
| 2 | ATR-based SL validation (replaces fixed % threshold) | ✅ Done |
| 3 | Manual override warning (user changed AI auto-fill) | ✅ Done |
| 4 | Beginner onboarding tour (driver.js, 5 steps) | ✅ Done |
| 5 | Trade Journal with AI review (DeepSeek, cached) | ✅ Done |

---

## 18. Phase 2 Features (completed March 2026)

### 18.1 Chat History (persistent)
- Messages persisted in Supabase `chat_messages` table
- History loads on page mount, scrolls to bottom
- Full conversation context sent to AI on each message
- DB migration: `003_chat_history.sql`

### 18.2 Watchlist
- Users can add/remove any of the 25+ markets to a personal watchlist
- Stored in Supabase `watchlist` table (user_id + symbol)
- Watchlist page at `/dashboard/watchlist` showing live prices for saved symbols
- DB migration: `004_watchlist.sql`

### 18.3 Consensus History
- Every AI analysis result is saved to Supabase (`consensus_history` table)
- Component `ConsensusHistory` on each market detail page shows last 10 analyses
- Displays: timestamp, direction (Bullish/Bearish/Neutral), score, agreement level, timeframe
- DB migration: `003_chat_history.sql` (same migration batch)

### 18.4 Price Alerts
- Users can set price alerts for any market (above/below a target price)
- Stored in Supabase `price_alerts` table
- `PriceAlertButton` component next to refresh button on market detail page
- Alert delivery via Resend email (RESEND_API_KEY required in env)
- DB migration: `005_price_alerts.sql`

### 18.5 Analytics Dashboard
- Full performance dashboard at `/dashboard/analytics`
- Metrics: Win Rate, Total P&L, Virtual Balance, Total Trades, Active Trades
- **Professional risk metrics** (institutional standards):
  - **Expectancy** (Van Tharp formula): `(winRate × avgWin) - (lossRate × avgLoss)`; shows breakeven win rate
  - **Profit Factor**: gross profit / gross loss; green ≥1.5, amber ≥1, red <1
  - **Max Drawdown**: peak-to-trough from equity curve; green ≤10%, amber ≤20%, red >20%
- Equity curve chart (recharts) showing cumulative P&L over all closed trades
- Win/Loss distribution bar chart
- Trade history table with all metrics

### 18.6 Multi-Timeframe (MTF) Analysis Widget
- Runs analysis across multiple timeframes simultaneously (1m, 5m, 15m, 1h, 4h, 1d)
- Shows consensus direction per timeframe with color coding
- Highlights timeframe alignment (when most TFs agree = stronger signal)

---

## 19. Advanced Trading Engine (completed March 2026)

Research-backed improvements to simulator quality, based on institutional trading standards.

### 19.1 ATR Calculator (Wilder's Method)
- **File:** `src/lib/atr-calculator.ts`
- Proper Wilder's smoothing: seed with SMA of first 14 TRs, then EMA-style `atr = (atr×13 + TR) / 14`
- **Pip utilities:** `getPipSize`, `getPipLabel`, `priceToPips`, `pipsToPrice`
  - Forex JPY pairs: 0.01 → label "p"
  - Standard forex: 0.0001 → label "p"
  - POINTS_ASSETS (IXIC, SPX, DXY, XAU/USD, XAG/USD, CL): 1.0 → label "pts"
- **Volatility ratio:** `ATR(14) / rolling-20-bar-avg-of-ATR(14)`; ratio > 1.5 = spike, avoid trading
- **Outlier filter:** bars with H-L > 5% of close are excluded before ATR calc (corrupt/gap bars)
- **Sanity check:** if ATR > 3% of current price, fall back to ATR_DEFAULTS (prevents wildly wrong values)
- **ATRAnalysis** interface now includes `pipLabel` field ("p" or "pts")
- Defaults per symbol (extended with IXIC: 25pts, SPX: 20pts)

### 19.2 Market Regime Detection
- **File:** `src/lib/market-regime.ts`
- **ADX (Average Directional Index):** Wilder's formula with +DM/-DM/TR smoothing
- **Thresholds (research-backed):**
  - ATR ratio > 1.5 → **Choppy** (volatility spike, skip trade)
  - ADX > 25 → **Trending** (trend-following, target 1:3 R:R)
  - ADX < 20 → **Ranging** (mean-reversion, target 1:2 R:R)
  - ADX 20–25 → **No Clear Trend** (reduce size or wait)
- Returns: regime, label, color (green/amber/red), tip, recommendedRR, isVolatile, adx

### 19.3 Dynamic R:R in Simulator
- **Minimum R:R adapts to market regime:**
  - Trending market (ADX > 25): minimum 1:3
  - All other regimes: minimum 1:2
- **Regime badge** shown in QuickSimWidget header: "Trending · 1:3" / "Ranging · 1:2" / "No Clear Trend · 1:2"
- **Volatility spike warning** (red banner): fires when ATR ratio > 1.5 — warns user to avoid trading
- **R:R warning** is context-aware: explains *why* based on current regime

### 19.4 ATR-Based SL Auto-Fill (improved)
- **Floor:** SL = `max(structureSL, 1.5×ATR)` — SL never inside market noise
- **Ceiling:** SL = `min(uncappedSL, 3×ATR)` — SL never absurdly wide (e.g. USD/JPY 3391 pip bug was fixed this way)
- Blue info banner shown when ceiling cap is applied: "SL adjusted to 3×ATR"
- TP calculated to achieve minimum R:R for current regime
- **ATR display in widget header:** "ATR 45p" (forex) or "ATR 24pts" (indices)
- **SL width display under SL field:** "SL: 68p · ATR: 45p · 1.5×ATR" — color coded green/amber/red

### 19.5 Risk Metrics Library
- **File:** `src/lib/risk-metrics.ts`
- `calcProfitFactor(trades)` — PF = gross profit / gross loss
- `calcExpectancy(trades)` — Van Tharp: `(W% × avgWin) - (L% × avgLoss)`, + breakeven win rate
- `calcMaxDrawdown(trades)` — peak-to-trough from cumulative equity curve
- `calcSharpeRatio(trades)` — per-trade Sharpe (mean / stdDev)

### 19.6 Supabase Realtime Sync
- `useSimulator` hook subscribes to `postgres_changes` on `paper_trades` table
- Trades auto-update when cron closes them externally — no manual refresh needed
- Daily trade limit now correctly counts only **open** trades (closed trades no longer block new ones)

---

## 19.7 Simulator Empty State (onboarding)
- When simulator page has no trades at all, a 3-step guide is shown:
  1. Pick a market → 2. Run AI Analysis → 3. Open a trade
- Quick-links to 5 popular markets: Gold, EUR/USD, GBP/USD, Crude Oil, S&P 500

---

## 20. MT5 Live Trading (Premium, March 2026)

Connect a real MetaTrader 5 account to NeuroQuant. View live trades and close them with one click — directly from the app.

### Architecture
- **No passwords stored** — webhook-only approach
- User generates a unique webhook URL + secret in the app
- User installs the NeuroQuant EA (Expert Advisor) in MT5
- EA pushes trade events to the webhook; NeuroQuant stores them in Supabase
- User clicks "Close" → command queued → EA polls every 10s and executes in MT5

### Pages & API
| Route | Purpose |
|---|---|
| `/dashboard/live-trading` | Main page: risk disclaimer → setup → live trades |
| `POST /api/mt5` | Generate webhook credentials |
| `POST /api/mt5/webhook/[token]` | EA pushes trade events (heartbeat, open, update, close, account_info) |
| `GET /api/mt5/webhook/[token]` | EA polls for pending commands |
| `POST /api/mt5/command` | Queue close_trade command |

### DB Tables (migration 006)
- `mt5_connections` — one row per user: token, secret, account_info, last_heartbeat
- `mt5_trades` — live trades from EA (open + closed)
- `mt5_commands` — command queue: pending → sent → confirmed

### Security
- HMAC-SHA256 signature verification on all EA webhook POSTs
- Commands only accepted for verified connections
- RLS on all tables — users see only their own data
- Risk disclaimer modal (localStorage) before accessing the page

### EA (TODO)
- Full MQL5 Expert Advisor code still needs to be written
- EA responsibilities: send trade events, poll commands, execute close in MT5, send heartbeat every 60s
- Configuration inputs: WebhookURL, WebhookSecret, PollSeconds

---

## 20b. Active Trade Card on Market Detail Page (March 2026)

When a user has an open trade for a symbol, a card appears on the market detail page directly above the QuickSimWidget.

### Shows:
- Direction badge (BUY/SELL) + realtime P&L (% and $) — green/red
- Entry price
- Stop-Loss with distance-to-target ("X% away" or "⚠ breached")
- Take-Profit with distance-to-target ("X% away" or "🎯 reached")
- Close trade button (uses WebSocket price for closing)

### Price source:
- Uses `useMarketData()` WebSocket price (same as simulator page) — P&L is consistent across the app
- Fallback to REST price if WebSocket not yet connected

---

## 21. Pages (complete)

| Page | Access | Description |
|---|---|---|
| `/dashboard/analytics` | All tiers | Performance dashboard with equity curve, risk metrics |
| `/dashboard/watchlist` | All tiers | Personal watchlist with live prices |
| `/dashboard/chat` | All tiers | AI chat with persistent history |
| `/dashboard/live-trading` | Premium | MT5 live trading — view & close real trades |

---

## 22. Pending / Roadmap

| Feature | Priority | Notes |
|---|---|---|
| Stripe payments integration | 🔴 Critical | Users can't upgrade — checkout/portal/webhooks needed |
| RESEND_API_KEY in Cloudflare Pages | 🔴 Critical | Price alerts email delivery won't work without it |
| MT5 EA (MQL5 Expert Advisor) | 🟡 High | Full EA code to write — webhook push + command polling + close execution |
| Time-of-day session filter | 🟡 Medium | Warn if trading outside London/NY sessions in QuickSimWidget |
| Push notifications | 🟡 Medium | Browser push for price alerts |
| Backtesting | 🟢 Low | Replay historical data through strategies |
| Historical reports (Premium) | 🟢 Low | Planned feature in tier table |
| API access (Premium) | 🟢 Low | Planned feature in tier table |

---

---

## 23. Security Notes (March 2026)

- **AI prompts:** Fully server-side in `src/lib/ai/` — never sent to the browser
- **API keys:** Cloudflare env vars only — never in client bundles
- **Supabase RLS:** All user tables protected — users see only their own data
- **Client-side exposure (unavoidable):** React bundles, API endpoint names, streamed analyst text
- **Risk score + ATR libs:** Defined in `src/lib/` — may be bundled client-side (review before launch)
- **MT5 webhook token:** In URL path — HMAC on payload protects integrity but token is visible in logs

*Updated: 2026-03-26 | For internal review and AI consultant feedback only*
