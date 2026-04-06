-- Market scan cache — stores the latest AI scan result globally
-- Only one row exists at a time (id = 'latest')
create table if not exists market_scan_cache (
  id text primary key default 'latest',
  data jsonb not null,
  scanned_at timestamptz not null default now()
);

-- No RLS needed — only written by service role (cron), read by anon
alter table market_scan_cache enable row level security;

create policy "Anyone can read scan cache"
  on market_scan_cache for select
  using (true);

-- Only service role can write
create policy "Service role can upsert scan cache"
  on market_scan_cache for all
  using (auth.role() = 'service_role');
