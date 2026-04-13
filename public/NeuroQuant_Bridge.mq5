//+------------------------------------------------------------------+
//|                                    NeuroQuant_Bridge.mq5        |
//|              NeuroQuant AI Analyst — Live Trading Bridge        |
//|                            https://neuroquant.app               |
//+------------------------------------------------------------------+
//
//  WHAT DOES THIS EA DO?
//  ---------------------
//  - Streams all your open trades to the NeuroQuant dashboard in real-time
//  - You can close any trade with one click from your browser
//  - The EA executes that close order instantly in MT5
//
//  INSTALLATION (5 steps):
//  -----------------------
//  1. Copy this file to: [MT5 folder]\MQL5\Experts\
//     (Tip: File > Open Data Folder > MQL5\Experts)
//
//  2. Compile it in MetaEditor (press F7 or click Build)
//     — there should be zero errors.
//
//  3. In MT5: Tools > Options > Expert Advisors
//     Check:  "Allow WebRequest for listed URL"
//     Add:    https://neuroquant.app
//     Click OK.
//
//  4. Drag the EA onto any chart (e.g. EURUSD H1).
//     In the window that appears, fill in:
//       - Webhook URL    → copy from NeuroQuant > Live Trading
//       - Webhook Secret → copy from NeuroQuant > Live Trading
//     Enable "Allow live trading"
//     Click OK.
//
//  5. Done! Go to https://neuroquant.app/dashboard/live-trading
//     Your trades appear on the dashboard automatically.
//
//+------------------------------------------------------------------+
#property copyright   "NeuroQuant.app"
#property link        "https://neuroquant.app"
#property version     "1.10"
#property description "NeuroQuant Live Trading Bridge v1.10"
#property description "Streams your MT5 trades to the NeuroQuant dashboard."
#property description " "
#property description "STEP 1: Tools > Options > Expert Advisors"
#property description "        Allow WebRequest > add: https://neuroquant.app"
#property description "STEP 2: Fill in Webhook URL and Secret below"
#property description "        (copy from NeuroQuant > Live Trading)"

//==================================================================
//  SETTINGS
//==================================================================

input group "=== NeuroQuant Connection ==="
input string InpWebhookURL    = "";  // Webhook URL    ← copy from NeuroQuant > Live Trading
input string InpWebhookSecret = "";  // Webhook Secret ← copy from NeuroQuant > Live Trading

input group "=== Timing (seconds) ==="
input int InpHeartbeatSec = 30;  // Heartbeat interval          (recommended: 30)
input int InpUpdateSec    = 10;  // Trade update push interval  (recommended: 10)
input int InpPollSec      = 5;   // Poll interval for commands  (recommended: 5)

input group "=== Safety ==="
input bool   InpAllowRemoteClose = true;   // Allow NeuroQuant to close trades from the browser
input double InpMaxCloseVolume   = 10.0;   // Max volume (lots) that may be closed remotely
input int    InpSlippage         = 20;     // Max slippage in points on market close

//==================================================================
//  GLOBALS  (internal state — do not change)
//==================================================================

bool  g_initialized   = false;
int   g_tickHeartbeat = 0;
int   g_tickUpdate    = 0;
int   g_tickPoll      = 0;

// Struct to track open positions between timer ticks
struct CachedPosition {
   ulong    ticket;
   string   symbol;
   string   type;          // "buy" or "sell"
   double   volume;
   double   openPrice;
   double   currentPrice;
   double   sl;
   double   tp;
   double   profit;
   datetime openTime;
};

CachedPosition g_cache[];
int            g_cacheSize = 0;

//==================================================================
//  HELPERS
//==================================================================

// Convert a string to a uchar byte array (UTF-8)
void StrToUChar(const string str, uchar &arr[])
{
   StringToCharArray(str, arr, 0, StringLen(str), CP_UTF8);
}

// Convert a uchar byte array to a lowercase hex string (e.g. "a3f1...")
string ToHex(const uchar &arr[])
{
   string hex = "";
   int n = ArraySize(arr);
   for(int i = 0; i < n; i++)
      hex += StringFormat("%02x", arr[i]);
   return hex;
}

// Convert a datetime to ISO 8601 format  (e.g. "2024-01-15T10:30:00Z")
string TimeToISO(datetime dt)
{
   MqlDateTime t;
   TimeToStruct(dt, t);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      t.year, t.mon, t.day, t.hour, t.min, t.sec);
}

// Escape a string for safe use inside a JSON value
string JsonStr(const string s)
{
   string r = s;
   StringReplace(r, "\\", "\\\\");
   StringReplace(r, "\"", "\\\"");
   return r;
}

//==================================================================
//  HMAC-SHA256
//
//  Every POST we send is signed with this so the server can verify
//  it really came from your MT5 terminal and not from someone else.
//
//  Formula: HMAC(key, msg) =
//    SHA256( (key XOR opad)  ||  SHA256( (key XOR ipad) || msg ) )
//==================================================================
bool HmacSHA256(const uchar &key[], const uchar &msg[], uchar &out[])
{
   // Step 1: prepare key — hash it if longer than 64 bytes, then pad to 64
   uchar k[64];
   ArrayInitialize(k, 0);

   int kLen = ArraySize(key);
   if(kLen > 64)
   {
      uchar hashed[], empty[];
      if(CryptEncode(CRYPT_HASH_SHA256, key, empty, hashed) == 0) return false;
      int copyLen = ArraySize(hashed);
      if(copyLen > 64) copyLen = 64;
      for(int i = 0; i < copyLen; i++) k[i] = hashed[i];
   }
   else
   {
      for(int i = 0; i < kLen; i++) k[i] = key[i];
   }

   // Step 2: create ipad (key XOR 0x36) and opad (key XOR 0x5C)
   uchar ipad[64], opad[64];
   for(int i = 0; i < 64; i++)
   {
      ipad[i] = k[i] ^ 0x36;
      opad[i] = k[i] ^ 0x5C;
   }

   // Step 3: inner = SHA256(ipad || message)
   int msgLen = ArraySize(msg);
   uchar inner[], empty[];
   ArrayResize(inner, 64 + msgLen);
   for(int i = 0; i < 64;     i++) inner[i]      = ipad[i];
   for(int i = 0; i < msgLen; i++) inner[64 + i]  = msg[i];

   uchar innerHash[];
   if(CryptEncode(CRYPT_HASH_SHA256, inner, empty, innerHash) == 0) return false;

   // Step 4: result = SHA256(opad || inner)
   int ihLen = ArraySize(innerHash);
   uchar outer[];
   ArrayResize(outer, 64 + ihLen);
   for(int i = 0; i < 64;    i++) outer[i]      = opad[i];
   for(int i = 0; i < ihLen; i++) outer[64 + i]  = innerHash[i];

   uchar empty2[];
   if(CryptEncode(CRYPT_HASH_SHA256, outer, empty2, out) == 0) return false;
   return true;
}

// Compute HMAC-SHA256 signature for a JSON body string → hex
string Sign(const string body)
{
   uchar keyBytes[], msgBytes[], result[];
   StrToUChar(InpWebhookSecret, keyBytes);
   StrToUChar(body, msgBytes);
   if(!HmacSHA256(keyBytes, msgBytes, result)) return "";
   return ToHex(result);
}

//==================================================================
//  HTTP COMMUNICATION
//==================================================================

// POST a JSON event to NeuroQuant with HMAC signature.
// Returns true if the server responds HTTP 200.
bool PostEvent(const string jsonBody)
{
   if(StringLen(InpWebhookURL) == 0) return false;

   string sig     = Sign(jsonBody);
   string headers = "Content-Type: application/json\r\n"
                    "x-webhook-signature: " + sig + "\r\n";

   // Convert the JSON string to a char array for WebRequest
   int  bodyLen = StringLen(jsonBody);
   char postData[];
   ArrayResize(postData, bodyLen);
   for(int i = 0; i < bodyLen; i++)
      postData[i] = (char)StringGetCharacter(jsonBody, i);

   char   resp[];
   string respHeaders;
   int    status = WebRequest("POST", InpWebhookURL, headers, 10000, postData, resp, respHeaders);

   if(status == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("[NeuroQuant] ERROR: URL not allowed — go to Tools > Options > Expert Advisors"
               " and add '" + InpWebhookURL + "' to the WebRequest list.");
      else
         PrintFormat("[NeuroQuant] WebRequest error (code %d)", err);
      return false;
   }

   return (status == 200 || status == 201);
}

// GET pending commands from NeuroQuant.
// Returns the JSON response body, or "" on failure.
string GetCommands()
{
   if(StringLen(InpWebhookURL) == 0) return "";

   string headers = "x-webhook-secret: " + InpWebhookSecret + "\r\n";

   char emptyBody[], resp[];
   string respHeaders;
   int status = WebRequest("GET", InpWebhookURL, headers, 10000, emptyBody, resp, respHeaders);

   if(status == 200)
      return CharArrayToString(resp);

   return "";
}

//==================================================================
//  EVENTS
//==================================================================

void SendHeartbeat()
{
   PostEvent("{\"event\":\"heartbeat\",\"data\":{}}");
}

void SendAccountInfo()
{
   string json = StringFormat(
      "{\"event\":\"account_info\",\"data\":{"
         "\"balance\":%.2f,"
         "\"equity\":%.2f,"
         "\"margin\":%.2f,"
         "\"free_margin\":%.2f,"
         "\"profit\":%.2f,"
         "\"currency\":\"%s\","
         "\"account\":%d,"
         "\"server\":\"%s\","
         "\"name\":\"%s\""
      "}}",
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN),
      AccountInfoDouble(ACCOUNT_FREEMARGIN),
      AccountInfoDouble(ACCOUNT_PROFIT),
      JsonStr(AccountInfoString(ACCOUNT_CURRENCY)),
      (int)AccountInfoInteger(ACCOUNT_LOGIN),
      JsonStr(AccountInfoString(ACCOUNT_SERVER)),
      JsonStr(AccountInfoString(ACCOUNT_NAME))
   );
   PostEvent(json);
}

void SendTradeOpen(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;

   string sym    = PositionGetString(POSITION_SYMBOL);
   int    digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   string type   = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "buy" : "sell";
   double sl     = PositionGetDouble(POSITION_SL);
   double tp     = PositionGetDouble(POSITION_TP);
   // 0 means "no stop" — send JSON null so the dashboard shows nothing
   string slStr  = (sl > 0) ? StringFormat("%.*f", digits, sl) : "null";
   string tpStr  = (tp > 0) ? StringFormat("%.*f", digits, tp) : "null";

   string json = StringFormat(
      "{\"event\":\"trade_open\",\"data\":{"
         "\"ticket\":%I64u,"
         "\"symbol\":\"%s\","
         "\"type\":\"%s\","
         "\"volume\":%.2f,"
         "\"price\":%.*f,"
         "\"current\":%.*f,"
         "\"sl\":%s,"
         "\"tp\":%s,"
         "\"profit\":%.2f,"
         "\"time\":\"%s\""
      "}}",
      ticket,
      JsonStr(sym), type,
      PositionGetDouble(POSITION_VOLUME),
      digits, PositionGetDouble(POSITION_PRICE_OPEN),
      digits, PositionGetDouble(POSITION_PRICE_CURRENT),
      slStr, tpStr,
      PositionGetDouble(POSITION_PROFIT),
      TimeToISO((datetime)PositionGetInteger(POSITION_TIME))
   );
   PostEvent(json);
}

void SendTradeUpdate(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;

   string sym    = PositionGetString(POSITION_SYMBOL);
   int    digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double sl     = PositionGetDouble(POSITION_SL);
   double tp     = PositionGetDouble(POSITION_TP);
   string slStr  = (sl > 0) ? StringFormat("%.*f", digits, sl) : "null";
   string tpStr  = (tp > 0) ? StringFormat("%.*f", digits, tp) : "null";

   string json = StringFormat(
      "{\"event\":\"trade_update\",\"data\":{"
         "\"ticket\":%I64u,"
         "\"current\":%.*f,"
         "\"sl\":%s,"
         "\"tp\":%s,"
         "\"profit\":%.2f"
      "}}",
      ticket,
      digits, PositionGetDouble(POSITION_PRICE_CURRENT),
      slStr, tpStr,
      PositionGetDouble(POSITION_PROFIT)
   );
   PostEvent(json);
}

void SendTradeClose(ulong posTicket, double closePrice, double closeProfit, datetime closeTime)
{
   string json = StringFormat(
      "{\"event\":\"trade_close\",\"data\":{"
         "\"ticket\":%I64u,"
         "\"price\":%.5f,"
         "\"profit\":%.2f,"
         "\"time\":\"%s\""
      "}}",
      posTicket, closePrice, closeProfit, TimeToISO(closeTime)
   );
   PostEvent(json);
}

//==================================================================
//  POSITION CACHE
//==================================================================

void CacheAdd(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;

   if(g_cacheSize >= ArraySize(g_cache))
      ArrayResize(g_cache, g_cacheSize + 20);

   CachedPosition cp;
   cp.ticket       = ticket;
   cp.symbol       = PositionGetString(POSITION_SYMBOL);
   cp.type         = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "buy" : "sell";
   cp.volume       = PositionGetDouble(POSITION_VOLUME);
   cp.openPrice    = PositionGetDouble(POSITION_PRICE_OPEN);
   cp.currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
   cp.sl           = PositionGetDouble(POSITION_SL);
   cp.tp           = PositionGetDouble(POSITION_TP);
   cp.profit       = PositionGetDouble(POSITION_PROFIT);
   cp.openTime     = (datetime)PositionGetInteger(POSITION_TIME);

   g_cache[g_cacheSize++] = cp;
}

void CacheRemoveAt(int idx)
{
   for(int i = idx; i < g_cacheSize - 1; i++)
      g_cache[i] = g_cache[i + 1];
   g_cacheSize--;
}

int CacheFind(ulong ticket)
{
   for(int i = 0; i < g_cacheSize; i++)
      if(g_cache[i].ticket == ticket) return i;
   return -1;
}

//==================================================================
//  SYNC & CHANGE DETECTION
//==================================================================

// Push all currently open positions to NeuroQuant (called on startup)
void SyncAllPositions()
{
   int total = PositionsTotal();
   g_cacheSize = 0;
   ArrayResize(g_cache, total + 20);

   for(int i = 0; i < total; i++)
   {
      PositionGetSymbol(i);  // also selects the position
      ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
      SendTradeOpen(ticket);
      CacheAdd(ticket);
   }
   PrintFormat("[NeuroQuant] %d position(s) synced.", total);
}

// Detect newly opened and closed positions, push corresponding events
void CheckPositionChanges()
{
   int total = PositionsTotal();

   // Snapshot of currently open tickets
   ulong current[];
   ArrayResize(current, total);
   for(int i = 0; i < total; i++)
   {
      PositionGetSymbol(i);
      current[i] = (ulong)PositionGetInteger(POSITION_TICKET);
   }

   // --- Closed positions: in cache but no longer open ---
   for(int i = 0; i < g_cacheSize; i++)
   {
      ulong cachedTicket = g_cache[i].ticket;
      bool  stillOpen    = false;

      for(int j = 0; j < total; j++)
         if(current[j] == cachedTicket) { stillOpen = true; break; }

      if(!stillOpen)
      {
         // Position closed — look up close data in deal history
         double   closePrice  = 0;
         double   closeProfit = 0;
         datetime closeTime   = TimeCurrent();

         if(HistorySelect(TimeCurrent() - 120, TimeCurrent()))
         {
            int deals = HistoryDealsTotal();
            for(int d = deals - 1; d >= 0; d--)
            {
               ulong dealTkt = HistoryDealGetTicket(d);
               if(HistoryDealGetInteger(dealTkt, DEAL_POSITION_ID) == (long)cachedTicket &&
                  HistoryDealGetInteger(dealTkt, DEAL_ENTRY)       == DEAL_ENTRY_OUT)
               {
                  closePrice  = HistoryDealGetDouble(dealTkt, DEAL_PRICE);
                  closeProfit = HistoryDealGetDouble(dealTkt, DEAL_PROFIT);
                  closeTime   = (datetime)HistoryDealGetInteger(dealTkt, DEAL_TIME);
                  break;
               }
            }
         }

         PrintFormat("[NeuroQuant] Trade closed: ticket=%I64u  profit=%.2f", cachedTicket, closeProfit);
         SendTradeClose(cachedTicket, closePrice, closeProfit, closeTime);
         CacheRemoveAt(i);
         i--;
      }
   }

   // --- New positions: open but not yet in cache ---
   for(int i = 0; i < total; i++)
   {
      ulong ticket = current[i];
      if(CacheFind(ticket) < 0)
      {
         PrintFormat("[NeuroQuant] New trade detected: ticket=%I64u", ticket);
         SendTradeOpen(ticket);
         CacheAdd(ticket);
      }
   }
}

// Push profit/price updates for all cached open positions
void PushProfitUpdates()
{
   for(int i = 0; i < g_cacheSize; i++)
   {
      ulong ticket = g_cache[i].ticket;
      if(!PositionSelectByTicket(ticket)) continue;

      double newProfit  = PositionGetDouble(POSITION_PROFIT);
      double newCurrent = PositionGetDouble(POSITION_PRICE_CURRENT);
      double newSl      = PositionGetDouble(POSITION_SL);
      double newTp      = PositionGetDouble(POSITION_TP);

      // Only send an update if something actually changed
      bool changed = MathAbs(newProfit - g_cache[i].profit) >= 0.01
                  || newCurrent != g_cache[i].currentPrice
                  || newSl      != g_cache[i].sl
                  || newTp      != g_cache[i].tp;

      if(changed)
      {
         SendTradeUpdate(ticket);
         g_cache[i].profit       = newProfit;
         g_cache[i].currentPrice = newCurrent;
         g_cache[i].sl           = newSl;
         g_cache[i].tp           = newTp;
      }
   }
}

//==================================================================
//  CLOSE A POSITION
//  Called when NeuroQuant sends a close command from the dashboard.
//==================================================================
bool ClosePosition(ulong ticket)
{
   if(!InpAllowRemoteClose)
   {
      Print("[NeuroQuant] Remote close is disabled (InpAllowRemoteClose = false).");
      return false;
   }

   if(!PositionSelectByTicket(ticket))
   {
      PrintFormat("[NeuroQuant] Position %I64u not found — already closed?", ticket);
      return false;
   }

   double volume = PositionGetDouble(POSITION_VOLUME);

   // Safety: block if volume exceeds the allowed limit
   if(volume > InpMaxCloseVolume)
   {
      PrintFormat("[NeuroQuant] BLOCKED: position %I64u has volume %.2f which exceeds the limit of %.2f lots.",
         ticket, volume, InpMaxCloseVolume);
      return false;
   }

   string sym   = PositionGetString(POSITION_SYMBOL);
   bool   isBuy = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);

   MqlTradeRequest req = {};
   MqlTradeResult  res = {};
   req.action    = TRADE_ACTION_DEAL;
   req.symbol    = sym;
   req.volume    = volume;
   req.type      = isBuy ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
   req.price     = isBuy ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK);
   req.deviation = InpSlippage;
   req.position  = ticket;
   req.comment   = "NeuroQuant";

   if(!OrderSend(req, res) ||
      (res.retcode != TRADE_RETCODE_DONE && res.retcode != TRADE_RETCODE_DONE_PARTIAL))
   {
      PrintFormat("[NeuroQuant] Close failed for ticket %I64u — retcode=%d", ticket, res.retcode);
      return false;
   }

   PrintFormat("[NeuroQuant] Position %I64u closed at %.5f", ticket, res.price);
   return true;
}

//==================================================================
//  PROCESS COMMANDS
//
//  Parses the GET response and executes any pending close commands.
//  Expected format:
//  {
//    "commands": [
//      { "command_type": "close_trade", "payload": { "ticket": 12345 } }
//    ]
//  }
//==================================================================
void ProcessCommands(const string json)
{
   if(StringLen(json) == 0) return;
   if(StringFind(json, "\"close_trade\"") < 0) return;

   // Walk through the JSON string looking for "ticket": <number>
   string needle = "\"ticket\":";
   int    pos    = 0;

   while(true)
   {
      int idx = StringFind(json, needle, pos);
      if(idx < 0) break;

      idx += StringLen(needle);

      // Skip whitespace
      while(idx < StringLen(json) && StringGetCharacter(json, idx) == ' ')
         idx++;

      // Read the numeric ticket value
      string numStr = "";
      while(idx < StringLen(json))
      {
         ushort c = StringGetCharacter(json, idx);
         if(c >= '0' && c <= '9') { numStr += ShortToString(c); idx++; }
         else break;
      }

      if(StringLen(numStr) > 0)
      {
         ulong ticket = (ulong)StringToInteger(numStr);
         PrintFormat("[NeuroQuant] Received close command for ticket %I64u", ticket);
         ClosePosition(ticket);
      }

      pos = idx;
   }
}

//==================================================================
//  EA LIFECYCLE
//==================================================================

int OnInit()
{
   Print("╔══════════════════════════════════════════╗");
   Print("║  NeuroQuant Bridge v1.10                 ║");
   Print("║  https://neuroquant.app                  ║");
   Print("╚══════════════════════════════════════════╝");

   // Validate required inputs
   if(StringLen(InpWebhookURL) == 0)
   {
      Alert("NeuroQuant: Webhook URL is empty!\n\n"
            "Copy the URL from:\nNeuroQuant > Live Trading > Webhook URL");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(StringLen(InpWebhookSecret) == 0)
   {
      Alert("NeuroQuant: Webhook Secret is empty!\n\n"
            "Copy the Secret from:\nNeuroQuant > Live Trading > Webhook Secret");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(StringFind(InpWebhookURL, "https://") != 0)
   {
      Alert("NeuroQuant: Webhook URL must start with https://\n\n"
            "Please check that you copied the correct URL.");
      return INIT_PARAMETERS_INCORRECT;
   }

   PrintFormat("[NeuroQuant] Connecting to: %s", InpWebhookURL);
   PrintFormat("[NeuroQuant] Heartbeat: %ds | Updates: %ds | Poll: %ds",
               InpHeartbeatSec, InpUpdateSec, InpPollSec);

   if(!InpAllowRemoteClose)
      Print("[NeuroQuant] Note: remote close is DISABLED.");

   // 1-second timer — all timing runs through this
   EventSetTimer(1);

   g_initialized = false;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[NeuroQuant] EA stopped.");
}

//==================================================================
//  OnTimer — called every second
//==================================================================
void OnTimer()
{
   // First tick: push account info and all open positions
   if(!g_initialized)
   {
      g_initialized = true;
      SendAccountInfo();
      SyncAllPositions();
      Print("[NeuroQuant] Connected! Dashboard: https://neuroquant.app/dashboard/live-trading");
      return;
   }

   g_tickHeartbeat++;
   g_tickUpdate++;
   g_tickPoll++;

   // Heartbeat + account info
   if(g_tickHeartbeat >= InpHeartbeatSec)
   {
      g_tickHeartbeat = 0;
      SendHeartbeat();
      SendAccountInfo();
   }

   // Trade changes + profit updates
   if(g_tickUpdate >= InpUpdateSec)
   {
      g_tickUpdate = 0;
      CheckPositionChanges();
      PushProfitUpdates();
   }

   // Poll for close commands from the dashboard
   if(g_tickPoll >= InpPollSec)
   {
      g_tickPoll = 0;
      string resp = GetCommands();
      if(StringLen(resp) > 15 && StringFind(resp, "\"commands\":[]") < 0)
         ProcessCommands(resp);
   }
}

//==================================================================
//  OnTrade — fires immediately on any trade event in MT5
//  (new position, close, SL/TP change, etc.)
//==================================================================
void OnTrade()
{
   // Detect changes without waiting for the next timer tick
   CheckPositionChanges();
}
