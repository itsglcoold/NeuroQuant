-- Trade Journal: stores AI-generated reviews for closed trades
CREATE TABLE IF NOT EXISTS trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES paper_trades(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ai_review TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trade_id) -- one review per trade
);

ALTER TABLE trade_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own journal entries"
  ON trade_journal FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON trade_journal FOR INSERT
  WITH CHECK (auth.uid() = user_id);
