-- Add watchlist column to profiles (array of market symbols)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS watchlist text[] NOT NULL DEFAULT '{}';
