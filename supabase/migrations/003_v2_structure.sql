-- ================================================
-- 003 · V2 结构迁移：记忆系统 + 多日旅行 + 手记 + 装扮
-- 对齐 docs/product/卡皮巴拉产品设计文档_v2.md
-- 在 002_visiting.sql 之后执行
-- ================================================

-- ------------------------------------------------
-- 1. memories · 结构化记忆（带 shareable 分档）
-- ------------------------------------------------
create table if not exists memories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  capybara_id  uuid not null references capybaras(id) on delete cascade,
  topic        text not null,                     -- AI 归纳的主题标签
  summary      text not null,                     -- 对话片段摘要
  emotion      text,                              -- 情感标签
  shareable    boolean not null default true,      -- 可分享/私密
  sensitive_category text,                         -- 敏感类别（null=不敏感）
  source_conversation_id uuid,                     -- 来源对话 ID
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_memories_user
  on memories(user_id, created_at desc);
create index if not exists idx_memories_shareable
  on memories(user_id, shareable) where shareable = true;

-- ------------------------------------------------
-- 2. travel_locations · 真实世界地点库
-- ------------------------------------------------
create table if not exists travel_locations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                     -- "京都·下鸭神社附近"
  region       text not null,                     -- "日本·京都"
  tags         text[] not null default '{}',       -- ["樱花","温泉","老城"]
  description  text,
  visual_keywords text[] not null default '{}',    -- 视觉关键词
  created_at   timestamptz not null default now()
);

create index if not exists idx_travel_locations_tags
  on travel_locations using gin(tags);

-- ------------------------------------------------
-- 3. travels · 多日旅行记录（替代 V1 explorations 的 V2 版本）
-- ------------------------------------------------
create table if not exists travels (
  id              uuid primary key default gen_random_uuid(),
  capybara_id     uuid not null references capybaras(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  status          text not null default 'traveling',  -- traveling | completed
  location_id     uuid references travel_locations(id),
  duration_days   int not null default 1,             -- 1-5 天
  intent_keywords jsonb default '[]'::jsonb,
  matched_user_id uuid references profiles(id),       -- 被匹配的对方
  items_found     jsonb default '[]'::jsonb,
  story           text,
  started_at      timestamptz not null default now(),
  estimated_return timestamptz not null,
  completed_at    timestamptz
);

create index if not exists idx_travels_user_status
  on travels(user_id, status);
create index if not exists idx_travels_active
  on travels(status) where status = 'traveling';

-- ------------------------------------------------
-- 4. journals · 每日旅行手记
-- ------------------------------------------------
create table if not exists journals (
  id                  uuid primary key default gen_random_uuid(),
  travel_id           uuid not null references travels(id) on delete cascade,
  user_id             uuid not null references profiles(id) on delete cascade,
  day_number          int not null default 1,
  location_name       text not null,
  narrative           text not null,              -- 80-180字叙事
  encounter_narrative text,                        -- 匹配相遇段落
  encounter_user_id   uuid references profiles(id),
  encounter_score     numeric(4,3),
  daily_item          jsonb,                       -- 当日小物件
  created_at          timestamptz not null default now()
);

create index if not exists idx_journals_travel
  on journals(travel_id, day_number);
create index if not exists idx_journals_user
  on journals(user_id, created_at desc);

-- ------------------------------------------------
-- 5. costume_items · 卡皮装扮物品库
-- ------------------------------------------------
create table if not exists costume_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  capybara_id  uuid not null references capybaras(id) on delete cascade,
  name         text not null,
  slot         text not null,                     -- head | body | tail | accessory
  description  text,
  origin_story text,                               -- 来历说明
  source       text not null default 'exploration', -- exploration | gift | default
  rarity       text not null default 'common',
  created_at   timestamptz not null default now()
);

create index if not exists idx_costume_items_capybara
  on costume_items(capybara_id);

-- ------------------------------------------------
-- 6. 扩展 capybaras 表字段
-- ------------------------------------------------
alter table capybaras
  add column if not exists equipped_costumes jsonb default '{}'::jsonb,
  add column if not exists current_life_action text,
  add column if not exists last_travel_completed_at timestamptz,
  add column if not exists rest_until timestamptz;

-- ------------------------------------------------
-- 7. Row Level Security
-- ------------------------------------------------
alter table memories        enable row level security;
alter table travel_locations enable row level security;
alter table travels         enable row level security;
alter table journals        enable row level security;
alter table costume_items   enable row level security;

-- memories：用户读写自己的
drop policy if exists "memories_select_own" on memories;
create policy "memories_select_own" on memories
  for select using (user_id = auth.uid());
drop policy if exists "memories_insert_own" on memories;
create policy "memories_insert_own" on memories
  for insert with check (user_id = auth.uid());
drop policy if exists "memories_update_own" on memories;
create policy "memories_update_own" on memories
  for update using (user_id = auth.uid());
drop policy if exists "memories_delete_own" on memories;
create policy "memories_delete_own" on memories
  for delete using (user_id = auth.uid());

-- travel_locations：所有人可读
drop policy if exists "travel_locations_select_all" on travel_locations;
create policy "travel_locations_select_all" on travel_locations
  for select using (true);

-- travels：用户读写自己的
drop policy if exists "travels_select_own" on travels;
create policy "travels_select_own" on travels
  for select using (user_id = auth.uid());
drop policy if exists "travels_insert_own" on travels;
create policy "travels_insert_own" on travels
  for insert with check (user_id = auth.uid());
drop policy if exists "travels_update_own" on travels;
create policy "travels_update_own" on travels
  for update using (user_id = auth.uid());

-- journals：用户可读自己的 + 被匹配到时对方可读
drop policy if exists "journals_select" on journals;
create policy "journals_select" on journals
  for select using (
    user_id = auth.uid()
    or encounter_user_id = auth.uid()
  );
drop policy if exists "journals_insert_own" on journals;
create policy "journals_insert_own" on journals
  for insert with check (user_id = auth.uid());

-- costume_items：用户读写自己的
drop policy if exists "costume_items_select_own" on costume_items;
create policy "costume_items_select_own" on costume_items
  for select using (owner_id = auth.uid());
drop policy if exists "costume_items_insert_own" on costume_items;
create policy "costume_items_insert_own" on costume_items
  for insert with check (owner_id = auth.uid());
