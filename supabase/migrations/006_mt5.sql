-- MT5 live trading integration
-- One connection row per premium user

CREATE TABLE mt5_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  webhook_token TEXT UNIQUE NOT NULL,
  webhook_secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  account_info JSONB,
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE mt5_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mt5 connection" ON mt5_connections
  FOR ALL USING (auth.uid() = user_id);

-- Open and closed trades pushed by the EA
CREATE TABLE mt5_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mt5_ticket BIGINT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
  volume DECIMAL(10,2) NOT NULL,
  open_price DECIMAL(15,5) NOT NULL,
  current_price DECIMAL(15,5),
  stop_loss DECIMAL(15,5),
  take_profit DECIMAL(15,5),
  profit DECIMAL(10,2) DEFAULT 0,
  open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ,
  close_price DECIMAL(15,5),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, mt5_ticket)
);
ALTER TABLE mt5_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mt5 trades" ON mt5_trades
  FOR ALL USING (auth.uid() = user_id);

-- Commands queued by NeuroQuant, polled and executed by the EA
CREATE TABLE mt5_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  command_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'confirmed', 'failed')),
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE mt5_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mt5 commands" ON mt5_commands
  FOR ALL USING (auth.uid() = user_id);

-- Enable realtime for live trade updates
ALTER PUBLICATION supabase_realtime ADD TABLE mt5_trades;
