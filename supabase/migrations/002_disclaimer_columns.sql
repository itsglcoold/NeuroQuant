-- Add disclaimer tracking columns to profiles table
-- So we can log acceptance server-side (not just localStorage)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disclaimer_version text,
  ADD COLUMN IF NOT EXISTS disclaimer_accepted_at timestamptz;
