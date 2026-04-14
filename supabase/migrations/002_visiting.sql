-- ================================================
-- 002 · 卡皮巴拉串门 & 用户相似度匹配
-- 对齐 docs/architecture/卡皮巴拉串门与用户相似度匹配算法提案.md (P0)
-- 在 Supabase SQL Editor 中执行此文件（在 schema.sql 之后）
-- ================================================

-- ------------------------------------------------
-- 1. persona_cards · 卡皮巴拉对外"名片"缓存
-- ------------------------------------------------
-- 注意：提案中使用 pgvector 做 ANN 召回。P0 阶段先不强依赖 pgvector，
--      仅以 text[] 形式存主题与标签，走 sim_trait / sim_tag 的 Jaccard 打分。
--      如需启用向量召回，取消下方 pgvector 相关语句的注释。

-- create extension if not exists vector;

create table if not exists persona_cards (
  capybara_id     uuid primary key references capybaras(id) on delete cascade,
  owner_id        uuid not null references profiles(id) on delete cascade,
  name            text not null default '卡皮',
  traits          text[] not null default '{}',
  mood            text,
  level           int not null default 1,
  memory_topics   text[] not null default '{}',   -- 已脱敏聚类后的主题词
  recent_tags     text[] not null default '{}',   -- 最近 explorations 的关键词
  -- topic_vector vector(384),                     -- P1：启用 pgvector 时再开
  updated_at      timestamptz not null default now()
);

create index if not exists idx_persona_cards_owner
  on persona_cards(owner_id);

-- create index if not exists idx_persona_cards_vec
--   on persona_cards using ivfflat (topic_vector vector_cosine_ops);

-- ------------------------------------------------
-- 2. visits · 单次串门记录
-- ------------------------------------------------
create table if not exists visits (
  id           uuid primary key default gen_random_uuid(),
  a_capybara   uuid not null references capybaras(id) on delete cascade,
  b_capybara   uuid not null references capybaras(id) on delete cascade,
  a_owner      uuid not null references profiles(id) on delete cascade,
  b_owner      uuid not null references profiles(id) on delete cascade,
  score        numeric(4,3),      -- 精排 score(A, Bi)
  transcript   jsonb default '[]'::jsonb,   -- [{speaker, text}, ...]
  eval         jsonb,             -- §4.3 的裁判 JSON
  status       text not null default 'completed', -- pending | completed | discarded
  created_at   timestamptz not null default now()
);

create index if not exists idx_visits_a_owner_time
  on visits(a_owner, created_at desc);

create index if not exists idx_visits_b_owner_time
  on visits(b_owner, created_at desc);

-- ------------------------------------------------
-- 3. user_affinity · 用户亲和度（(min,max) 去重存储）
-- ------------------------------------------------
create table if not exists user_affinity (
  user_low       uuid not null references profiles(id) on delete cascade,
  user_high      uuid not null references profiles(id) on delete cascade,
  user_sim       numeric(4,3) not null,
  affinity       numeric(4,3),
  shared_topics  text[] not null default '{}',
  last_visit_at  timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);

create index if not exists idx_user_affinity_low  on user_affinity(user_low, user_sim desc);
create index if not exists idx_user_affinity_high on user_affinity(user_high, user_sim desc);

-- ------------------------------------------------
-- 4. Row Level Security
-- ------------------------------------------------
alter table persona_cards enable row level security;
alter table visits        enable row level security;
alter table user_affinity enable row level security;

-- persona_cards：用户可以读自己的；匹配服务用 service_role 读全表
drop policy if exists "persona_cards_select_own" on persona_cards;
create policy "persona_cards_select_own" on persona_cards
  for select using (owner_id = auth.uid());

drop policy if exists "persona_cards_upsert_own" on persona_cards;
create policy "persona_cards_upsert_own" on persona_cards
  for insert with check (owner_id = auth.uid());

drop policy if exists "persona_cards_update_own" on persona_cards;
create policy "persona_cards_update_own" on persona_cards
  for update using (owner_id = auth.uid());

-- visits：仅参与者双方可读
drop policy if exists "visits_select_participants" on visits;
create policy "visits_select_participants" on visits
  for select using (a_owner = auth.uid() or b_owner = auth.uid());

-- user_affinity：仅 (user_low, user_high) 两方可读
drop policy if exists "user_affinity_select_participants" on user_affinity;
create policy "user_affinity_select_participants" on user_affinity
  for select using (user_low = auth.uid() or user_high = auth.uid());
