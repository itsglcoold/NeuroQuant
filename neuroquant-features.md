# NeuroQuant — Complete Feature Overview
> AI-powered market analysis platform | Version: April 2026 (sessie 2026-04-14) | Stack: Next.js 15.5 + Supabase + Cloudflare Pages

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
| DeepSeek V3 (`deepseek-chat`) | Analyst Alpha | DeepSeek API | 40% | Quantitative / Technical indicators |
| Qwen3-Max (`qwen3-max-2025-09-23`) | Analyst Beta | Alibaba DashScope | 40% | Visual patterns / Chart structure |
| Claude Opus 4.6 (`claude-opus-4-6`) | Analyst Gamma | Anthropic | 20% | Macro / Fundamental / Cross-market |

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
- **Candlestick patterns** detected from the most recent bars and fed to all three AI analysts as additional context (Hammer, Shooting Star, Doji variants, Engulfing, Inside Bar, Tweezers, Morning/Evening Star)

### Streaming Protocol
Analysis results stream via SSE (Server-Sent Events) with events:
`status` → `market_data` → `analyst_alpha` → `analyst_beta` → `analyst_gamma` → `consensus`

### Timeouts
- 35s per analyst (verhoogd van 25s om grotere modellen te accommoderen)
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

| Asset group | Source | Notes |
|---|---|---|
| Forex (22 pairs) | EODHD WebSocket (live ask) | Active during market hours |
| Gold (XAU/USD) | Yahoo Finance `GC=F` REST | Futures — same source as chart |
| Silver (XAG/USD) | Yahoo Finance `SI=F` REST | Futures — same source as chart |
| Crude Oil (CL) | Yahoo Finance `CL=F` REST | Futures |
| Indices (DXY, SPX, IXIC) | EODHD REST (NDX.INDX etc.) | No WebSocket available |

- **Displayed:** Price, 24h change ($), 24h change (%), High/Low/Open/Prev Close
- **Latency indicator:** < 500ms green, < 1500ms amber, > 1500ms orange
- **Session tracker:** Shows which trading sessions are currently open (Sydney / Tokyo / London / New York)
- **Note:** XAU/USD and XAG/USD intentionally excluded from WebSocket — EODHD forex WS returns the LBMA London Fix benchmark price (2×/day snapshot), not the live spot price. Yahoo Finance REST is always used for metals.

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
- **AI Model:** Qwen3.5-Plus vision (`qwen3.5-plus-2026-02-15`) — native vision-language, SOTA multimodal
- **Pro+ only**

### 9-Step Professional Analysis
1. Context (symbol, timeframe, price range)
2. Market Structure (BOS, ChoCH, order blocks, Fair Value Gaps, premium/discount zones)
3. Chart Patterns (H&S, double top/bottom, wedge, triangle, flag, pennant, channel, etc.)
4. Candlestick Patterns (pin bar, engulfing, doji, inside bar, morning/evening star, etc.)
5. Support & Resistance (exact price levels)
6. Indicators (every visible indicator with exact value and signal)
7. Trend Analysis (primary + secondary trend, momentum)
8. Key Trade Zones (SL placement, target levels with S/R confluence)
9. Synthesis (directional bias + confidence)

### Output Fields
- Symbol, Timeframe, Trading Style detection
- Direction (Bullish / Bearish / Neutral) + Confidence %
- Detected Patterns (chart + candlestick)
- Support & Resistance levels
- Market Structure description
- Nearest Support / Nearest Resistance callouts
- Indicator Readings (with exact values)
- Stop Loss Zone (with price)
- T1 / T2 Target Zones (with prices)
- Scalp Outlook + Swing Outlook
- Full written analysis

---

## 8. AI Market Research (Daily Suggestions)

- Scans **alle 28 markten** (5 scalping + 8 daytrading + 15 swing) — AI kiest beste 15 (5 per stijl)
- **Groups results by trading style:** Scalping / Daytrading / Swing Trading
- **Each suggestion shows:** Symbol, Direction, Confidence %, Sentiment label, Probability alignment, Key level, Reasoning, Timeframe, Candlestick Pattern, Confluence Score/Grade, Market Regime
- **OHLC enrichment** per suggestion: candlestick pattern + regime + confluence score berekend na AI-merge
  - Scalping: 5min bars · Daytrading: 1h bars · Swing: 4h bars
- **Cache:** 30 min fresh, 4 hours stale (serves stale if refresh fails)
- **Pro+ only**
- Premium: toont alle 15 · Pro: toont top 9 (3 per stijl)

---

## 9. MT5 Live Trading Bridge (Premium)

A real-time bridge between MetaTrader 5 and the NeuroQuant dashboard. **Premium only.**

### Architecture
- **MT5 EA** (`NeuroQuant_Bridge.mq5`) runs inside the trader's MT5 terminal
- EA pushes all trade events to a personal webhook URL via HTTP POST
- Dashboard subscribes to live trade updates via Supabase Realtime
- Close commands flow: browser click → Supabase → webhook GET → EA executes in MT5

### EA Features
- HMAC-SHA256 signed requests (every POST is authenticated)
- Heartbeat every 30s — dashboard shows online/offline status
- `OnTrade()` fires instantly on any trade event (no waiting for timer)
- Push intervals: updates every 10s, poll for commands every 5s
- Events: `heartbeat`, `account_info`, `trade_open`, `trade_update`, `trade_close`
- Safety: max volume limit, remote close toggle, slippage cap

### Dashboard Features
- Connection card with webhook URL + secret (copy-to-clipboard)
- Online/offline indicator (based on last heartbeat)
- Account info: balance, equity, free margin
- Live list of open trades: symbol, direction, entry price, current price, P&L
- **Close any trade with one click** — command queued → EA picks it up → executed at market
- Risk disclaimer gate (must accept before first use)

### Download & Install
- EA file: `https://neuroquant.app/NeuroQuant_Bridge.mq5`
- Install guide: `https://neuroquant.app/mt5-ea` (6-step instructions)

### Webhook API
- `POST /api/mt5/webhook/[token]` — EA pushes events (HMAC-signed)
- `GET /api/mt5/webhook/[token]` — EA polls for pending close commands
- `POST /api/mt5` — setup: generates webhook token + secret
- `POST /api/mt5/command` — queues a close command for a trade

---

## 10b. AI Chat

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
| AI — Technical | DeepSeek API (`deepseek-chat` V3) |
| AI — Chart/Visual | Alibaba DashScope (`qwen3-max-2025-09-23` tekst · `qwen3.5-plus-2026-02-15` vision) |
| AI — Strategic | Anthropic Claude (`claude-opus-4-6`) |
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
| `/mt5-ea` | Public | EA download page + 6-step installation guide |

---

## 22. Pending / Roadmap

| Feature | Priority | Notes |
|---|---|---|
| Stripe payments integration | 🔴 Critical | Users can't upgrade — checkout/portal/webhooks needed |
| RESEND_API_KEY in Cloudflare Pages | 🔴 Critical | Price alerts email delivery won't work without it |
| MT5 EA (MQL5 Expert Advisor) | ✅ Done | `public/NeuroQuant_Bridge.mq5` — HMAC-signed, all events, close commands |
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

---

## 24. Sessie 2026-03-27 — Candlestick Patterns + Confluence Score

### Simulator
- **Candlestick pattern detection** bij trade-open (The Candlestick Trading Bible methode)
  - Detecteert: Hammer, Shooting Star, Doji varianten, Engulfing, Inside Bar, Tweezers, Morning/Evening Star
  - `src/lib/candlestick-patterns.ts`
- **Confluence Score** (3-factor model): Trend 40% / Level 35% / Signal 25% → score 0–100
  - Grades: Excellent (≥80) / Good (≥65) / Moderate (≥50) / Poor (<50)
  - `src/lib/confluence-score.ts`
- Beide opgeslagen in `analysis_snapshot` JSONB (geen DB migratie nodig)

### AI Market Research
- 28 markten gescand → AI kiest beste 15 (5 per stijl)
- Elke suggestie verrijkt met candlestick pattern + confluence score + market regime

---

## 25. Sessie 2026-03-29 — Model Upgrades + Chart Analyse Uitgebreid

### Kritieke fix: alle AI modellen upgraded
Alle drie analysts draaiden op inferieure modellen — gecorrigeerd naar beste beschikbaar.

### Chart analyse: 9-staps prompt (zie sectie 7)
- max_tokens verhoogd: 1500 → 3000
- Nieuwe UI velden: Market Structure, Nearest S/R, Stop Loss Zone, T1/T2 Targets

### Paper Trading Test
- 28 trades gezet (1 per markt) op 2026-03-29 — evaluatie volgt over paar dagen

---

## 26. Sessie 2026-03-29/30 — Weekend Risk Manager + Multi-Market Analyser

### Weekend Risk Manager
- Waarschuwing + blokkering wanneer markten gesloten zijn (weekend UTC hours)
- Inline toggle in simulator widget
- Fix: correcte UTC market hours, Switch component vervangen door inline toggle

### Multi-Market Analyser (vervangt Bulk Trade Executor)
- Selector met alle 28 markten, gegroepeerd per categorie (Forex / Metals / Energy / Indices)
- Filter buttons: All / None / Forex / Metals / Energy / Indices
- Klik "Analyse X markets in tabs" → elk geselecteerd symbool opent in eigen tab
- Elke tab start automatisch de AI analyse (`?autoAnalyse=true`)
- Juiste timeframe per symbool via `?style=scalping|daytrading|swing`
- Popup blocker detectie + Engelstalige waarschuwing
- Standaard uitgeklapt
- **File:** `src/components/simulator/BulkTradeExecutor.tsx`

### Overige fixes sessie 2026-03-29/30
- Correcte decimal precision voor dollar change op market cards
- "Bible methodology" referentie verwijderd uit AISuggestions UI
- Simulator pagina opgeruimd — geen duplicate tekst meer
- `src/lib/trade-calculator.ts` toegevoegd — shared SL/TP formules (TRADE_STYLES + computeSlTpFromATR)

---

## 27. Sessie 2026-04-01 — Auth fix + Indicator screening + ATR fixes

### Auth fix: Multi-Market Analyser tabs
- Tabs openden met Free-tier beperkingen omdat `autoAnalyse` vuurt vóór Supabase tier-check klaar was
- Fix: `tierLoaded` state in `useUsageTracking` — autoAnalyse wacht tot DB tier bevestigd
- Geen tokens in URL's (veiligheidsrisico) — cookies werken correct tussen tabs

### AI Market Research: technische indicators in screening
- Screening AI krijgt nu RSI(14), MACD richting, Bollinger positie, SMA20/50 per markt
- Berekend uit pre-fetched OHLC bars (voor AI-selectie, niet erna)
- Pre-fetched bars hergebruikt in enrichSymbols → geen dubbele API calls
- Prompt: indicator confluence als primair selectiecriterium
- Vermindert grote tegenstrijdigheden met detail analyse

### ATR bugfix: alle timeframes
- **Oorzaak**: barCount 1D/4H = 30, maar ATR vereist ≥35 bars → altijd fallback
- **Oorzaak 2**: ATR_DEFAULTS miste alle cross pairs → CAD/JPY fallback = 0.0050 = 0.5p (was 1p in UI)
- Fix: barCount verhoogd (4H→45, 1D→50)
- Fix: ATR_DEFAULTS uitgebreid met 12 ontbrekende cross pairs
- Fix: lower bound check (ATR < 0.02% prijs → fallback)
- Resultaat: geen SL=0 of lot size explosie meer op 1D/4H

### Default timeframes gecorrigeerd
| Symbool | Was | Nu |
|---|---|---|
| XAU/USD | 5m | 15m |
| DXY | 5m | 15m |
| SPX | 5m | 15m |
| IXIC | 5m | 15m |
| EUR/USD | 5m | 15m |

Alle 5 zijn scalping-groep. AI adviseerde consistent om naar 15m te switchen → nu 15m als default.

---

## 28. Sessie 2026-04-11 — Bug fixes + Candlestick patterns als AI input

### Bug fixes

#### CL (Crude Oil) prijs discrepantie
- EODHD `CL.US` REST endpoint geeft stale EOD settlement ($84.46) in plaats van live WTI prijs ($90.76)
- Fix: twee-staps strategie in `src/lib/market/eodhd.ts`:
  1. Probeer `CLUSD.FOREX` endpoint (real-time voor forex plannen), sanity check $20–$200
  2. Fallback: Yahoo Finance `CL=F` (~15 min delayed maar accuraat)
- TradingView chart: blijft TVC:USOIL (kleine spot/futures afwijking acceptabel)
- Waarschuwingsbanner toegevoegd op CL marktpagina voor live traders

#### DisclaimerGate opnieuw getoond bij nieuwe browser/apparaat
- localStorage is device-specific → bestaande users moesten opnieuw accepteren op elk nieuw apparaat
- Fix in `src/components/dashboard/DisclaimerGate.tsx`:
  - Bij localStorage miss → check Supabase `profiles.disclaimer_version` + `profiles.disclaimer_accepted_at`
  - Als huidig versie + binnen 30 dagen → herstel localStorage, sla gate over
- `DISCLAIMER_VERSION = "2026-03"` bumpen bij wijziging Terms/Privacy/Risk Disclosure

#### Google OAuth double-login loop (derde keer opgelost)
- `prompt: "select_account"` verwijderd uit OAuth opties (forceerde re-auth elke keer)
- Sessie-check toegevoegd op login page mount: als al ingelogd → `window.location.replace("/dashboard")`

#### Scalping badge timeframe fout
- Badge toonde `"1m / 5m"` terwijl chart default op 15m staat
- Fix: `timeframeFocus` gewijzigd naar `"5m / 15m"` in `SCREENING_ROWS` en `STYLE_META` (`src/lib/market/symbols.ts`)

### Feature: Candlestick patterns als AI analyse input (detail pagina)
- `detectAllPatterns(timeSeries)` aangeroepen vóór de AI calls in `src/app/api/analysis/technical/route.ts`
- Gedetecteerde patronen toegevoegd aan `marketData.candlestickPatterns`
- `buildMarketDataContext()` in `src/lib/ai/prompts.ts` uitgebreid: voegt "Detected Candlestick Patterns" sectie toe aan AI context
- Alle drie analisten (Alpha/DeepSeek, Beta/Qwen, Gamma/Claude) ontvangen nu patrooninfo
- Puur additief — alle bestaande prijs- en indicatordata ongewijzigd

---

## 29. Sessie 2026-04-13 — Index prijsdiscrepantie fix

### Probleem
Bij grondige controle van alle 28 markten bleek dat de EODHD prijsfeed en de TradingView grafiek voor indices niet hetzelfde instrument toonden. Dit had directe impact op entry prijs, SL/TP auto-fill, ATR berekening en AI analyse input.

### Bevindingen per markt

| Markt | EODHD | TradingView | Status |
|---|---|---|---|
| IXIC | `IXIC.INDX` (NASDAQ Composite, ~16.700) | `OANDA:NAS100USD` (NASDAQ 100, ~18.000) | 🔴 ~1.200pt verschil — ander instrument |
| SPX | `GSPC.INDX` (cash index) | `OANDA:SPX500USD` (futures CFD) | ⚠️ Klein verschil buiten markturen |
| DXY | `DXY.INDX` | `CAPITALCOM:DXY` | ✅ Verwaarloosbaar verschil |
| 25 anderen | Forex/metals EODHD | FX/OANDA broker | ✅ Zelfde instrument |

### Fixes

#### IXIC (kritiek)
- `src/lib/market/eodhd.ts`: `IXIC.INDX` → `NDX.INDX` (NASDAQ 100 index)
- `src/lib/market/symbols.ts`: naam "NASDAQ" → "NASDAQ 100"
- `MARKET_CATEGORIES` beschrijving bijgewerkt naar "NASDAQ 100"
- TradingView `OANDA:NAS100USD` blijft ongewijzigd — was al correct

#### SPX
- Poging: `TVC:SPX` → geblokkeerd in TradingView embeds ("this symbol is only available on TradingView")
- Teruggedraaid naar `OANDA:SPX500USD` — werkt wel, prijsverschil tijdens markturen < 0.1%

#### Index pricing notice
- Informatieve badge toegevoegd op DXY/SPX/IXIC marktpagina's
- Melding: "Index prices update during exchange trading hours only"

### Technische context
- DXY/SPX/IXIC hebben **geen WebSocket** — prijzen komen altijd van EODHD REST polling
- Buiten markturen tonen index prijzen altijd de laatste slotkoers (fundamentele beperking)

---

## 30. Sessie 2026-04-13 (vervolg) — Trade Signal Banner

### Feature: Trade Signal Banner op market detail pagina

Na elke AI analyse verschijnt een grote full-width banner die de gebruiker direct vertelt of hij moet traden:

| Signal | Kleur | Criteria |
|---|---|---|
| ✓ **SETUP VALID** | Groen | Score ≥ ±60 + Alignment ≥ 75% + Agreement niet low |
| **! MARGINAL SETUP** | Amber | 2 van 3 criteria groen |
| **✕ SKIP THIS SETUP** | Rood | 0–1 criteria groen |

### Failure reasons — direction-aware en mensentaal
- Score te laag bullish: `Bullish signal too weak — score +25 needs to reach +60`
- Score te laag bearish: `Bearish signal too weak — score -25 needs to reach -60`
- Geen richting: `No clear direction — score needs to reach +60 or -60`
- Alignment te laag: `Analyst alignment too low — only 62% of analysts agree (needs 75%)`
- Agreement te laag: `Analysts disagree on direction — agreement level too low`

### Drempelwaarden
- Score: `|consensusScore| ≥ 60`
- Alignment: `probabilityScore ≥ 75%`
- Agreement: `agreementLevel !== "low"`

### Bestand
- `src/app/dashboard/market/[symbol]/page.tsx` — inline IIFE na de analyse grid

---

## 31. Sessie 2026-04-14 — WebSocket metals fix + MT5 EA

### Bug fix: Gold/Silver WebSocket price override
- **Root cause:** EODHD forex WebSocket was included in `WS_SYMBOL_MAP` for XAU/USD and XAG/USD
  → WS sends LBMA benchmark price (2×/day snapshot, ~$4669) which overrode Yahoo Finance REST ($4740)
- **Fix:** Removed XAU/USD and XAG/USD from `WS_SYMBOL_MAP` in `useEodhdWebSocket.ts`
  → Metals always use Yahoo Finance REST (GC=F / SI=F) — even during market hours
- **Commit:** c15d136

### Feature: MT5 Expert Advisor (MQL5) ✅
Complete MQL5 Expert Advisor bridging MT5 to the NeuroQuant dashboard.

**File:** `public/NeuroQuant_Bridge.mq5`

**EA capabilities:**
- HMAC-SHA256 signed POST requests (every message authenticated)
- `OnTrade()` fires immediately on any MT5 trade event
- Heartbeat + account info every 30s (balance, equity, free margin, server, account)
- Trade updates pushed every 10s (only if profit/price/SL/TP actually changed)
- Close commands polled every 5s via GET request — executed at market price
- Events: `heartbeat`, `account_info`, `trade_open`, `trade_update`, `trade_close`
- Safety: max volume cap, remote close toggle, slippage limit
- Startup validation: Alert on empty URL/Secret, non-HTTPS URL, URL not in WebRequest whitelist
- Startup sync: pushes all currently open positions on first timer tick

**Download page:** `src/app/mt5-ea/page.tsx` → `/mt5-ea`
- 6-step installation guide (download → copy → compile → WebRequest → attach → done)
- Requirements, safety note, link back to Live Trading dashboard

**Commit:** f5d68b5

*Updated: 2026-04-14 | For internal review and AI consultant feedback only*
