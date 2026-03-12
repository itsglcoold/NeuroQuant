-- ============================================
-- AI Market Analysis App - Initial Schema
-- ============================================

create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  stripe_customer_id  text unique,
  subscription_tier   text not null default 'premium'
                      check (subscription_tier in ('free', 'pro', 'premium')),
  subscription_status text not null default 'active'
                      check (subscription_status in ('active', 'inactive',
                             'past_due', 'canceled', 'trialing')),
  subscription_end_date timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- MARKET ANALYSES (cached AI results - shared)
-- ============================================
create table public.market_analyses (
  id              uuid primary key default uuid_generate_v4(),
  symbol          text not null,
  consensus_direction text,
  consensus_score     int,
  agreement_level     text,
  deepseek_output     jsonb,
  qwen_output         jsonb,
  claude_output       jsonb,
  merged_key_levels   jsonb,
  summary             text,
  market_data_snapshot jsonb,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '4 hours')
);

create index idx_market_analyses_symbol on public.market_analyses(symbol, created_at desc);

-- ============================================
-- CHART ANALYSES (user uploads)
-- ============================================
create table public.chart_analyses (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  image_url       text not null,
  analysis_result jsonb not null,
  detected_symbol text,
  direction       text,
  confidence      int,
  created_at      timestamptz not null default now()
);

create index idx_chart_analyses_user on public.chart_analyses(user_id, created_at desc);

-- ============================================
-- CHAT
-- ============================================
create table public.chat_conversations (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null default 'New conversation',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.chat_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index idx_chat_messages_conv on public.chat_messages(conversation_id, created_at);

-- ============================================
-- USAGE TRACKING
-- ============================================
create table public.usage_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  action_type     text not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index idx_usage_logs_user on public.usage_logs(user_id, created_at desc);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.profiles enable row level security;
alter table public.market_analyses enable row level security;
alter table public.chart_analyses enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.usage_logs enable row level security;

-- Profiles
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Market analyses: shared/public reads
create policy "Anyone reads market analyses" on public.market_analyses
  for select using (true);

-- Chart analyses: own data only
create policy "Users read own charts" on public.chart_analyses
  for select using (auth.uid() = user_id);
create policy "Users insert own charts" on public.chart_analyses
  for insert with check (auth.uid() = user_id);

-- Chat: own data only
create policy "Users read own conversations" on public.chat_conversations
  for select using (auth.uid() = user_id);
create policy "Users insert own conversations" on public.chat_conversations
  for insert with check (auth.uid() = user_id);
create policy "Users read own messages" on public.chat_messages
  for select using (
    conversation_id in (select id from public.chat_conversations where user_id = auth.uid())
  );
create policy "Users insert own messages" on public.chat_messages
  for insert with check (
    conversation_id in (select id from public.chat_conversations where user_id = auth.uid())
  );

-- Usage logs
create policy "Users read own usage" on public.usage_logs
  for select using (auth.uid() = user_id);
