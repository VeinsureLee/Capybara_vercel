-- ================================================
-- Capybara 卡皮巴拉养成社交产品 - 数据库初始化
-- 在 Supabase SQL Editor 中执行此文件
-- ================================================

-- 0. 扩展
create extension if not exists "uuid-ossp";

-- ================================================
-- 1. profiles 表（扩展 Supabase auth.users）
-- ================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar_url text,
  created_at timestamptz default now(),
  last_active_at timestamptz default now()
);

-- 注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', '旅人'));
  return new;
end;
$$ language plpgsql security definer;

-- 如果触发器已存在先删除
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================================================
-- 2. capybaras 表（卡皮巴拉伙伴）
-- ================================================
create table if not exists capybaras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null default '卡皮',
  personality_type text not null default 'default',
  traits jsonb default '["治愈","淡定","好奇","友善"]'::jsonb,
  mood text default 'calm',
  experience int default 0,
  level int default 1,
  status text default 'home',        -- home | exploring | visiting
  memory jsonb default '[]'::jsonb,  -- 关键记忆摘要
  created_at timestamptz default now(),
  unique(owner_id)
);

-- ================================================
-- 3. conversations 表（对话历史）
-- ================================================
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  capybara_id uuid not null references capybaras(id) on delete cascade,
  role text not null,       -- 'user' | 'capybara'
  content text not null,
  mood text,
  keywords jsonb,           -- AI 提取的关键词
  created_at timestamptz default now()
);

create index if not exists idx_conversations_user_time
  on conversations(user_id, created_at desc);

-- ================================================
-- 4. explorations 表（探索记录）
-- ================================================
create table if not exists explorations (
  id uuid primary key default gen_random_uuid(),
  capybara_id uuid not null references capybaras(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'ongoing',    -- ongoing | completed
  exploration_type text default 'short',     -- short | medium | long
  trigger_keywords jsonb,
  story text,
  items_found jsonb default '[]'::jsonb,     -- 探索发现的物品
  started_at timestamptz default now(),
  estimated_return timestamptz,
  completed_at timestamptz
);

create index if not exists idx_explorations_user_status
  on explorations(user_id, status);

-- ================================================
-- 5. Row Level Security
-- ================================================

alter table profiles enable row level security;
alter table capybaras enable row level security;
alter table conversations enable row level security;
alter table explorations enable row level security;

-- profiles
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (true);

drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- capybaras
drop policy if exists "capybaras_select" on capybaras;
create policy "capybaras_select" on capybaras for select using (owner_id = auth.uid());

drop policy if exists "capybaras_insert" on capybaras;
create policy "capybaras_insert" on capybaras for insert with check (owner_id = auth.uid());

drop policy if exists "capybaras_update" on capybaras;
create policy "capybaras_update" on capybaras for update using (owner_id = auth.uid());

-- conversations
drop policy if exists "conversations_select" on conversations;
create policy "conversations_select" on conversations for select using (user_id = auth.uid());

drop policy if exists "conversations_insert" on conversations;
create policy "conversations_insert" on conversations for insert with check (user_id = auth.uid());

-- explorations
drop policy if exists "explorations_select" on explorations;
create policy "explorations_select" on explorations for select using (user_id = auth.uid());

drop policy if exists "explorations_insert" on explorations;
create policy "explorations_insert" on explorations for insert with check (user_id = auth.uid());

drop policy if exists "explorations_update" on explorations;
create policy "explorations_update" on explorations for update using (user_id = auth.uid());
