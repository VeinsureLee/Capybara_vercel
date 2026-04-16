-- 007: 地点内容库 + 手记图片/文案字段
-- 用于存储探索图片和文学引用，支持按用户偏好个性化（未来）

-- 1. 地点内容表
create table if not exists location_content (
  id uuid primary key default gen_random_uuid(),
  location_name text,              -- 精确匹配地点名（可选）
  region_keyword text,             -- 区域关键词匹配（可选）
  image_url text not null,         -- 探索图片 URL
  image_caption text default '',   -- 图片标题
  quote text not null,             -- 文学/艺术引用
  quote_source text default '',    -- 引用来源
  tags text[] default '{}',        -- 标签（用于未来个性化）
  created_at timestamptz default now()
);

-- RLS
alter table location_content enable row level security;

-- 所有认证用户可读
create policy "Authenticated users can read location_content"
  on location_content for select
  to authenticated
  using (true);

-- 2. 为 journals 表添加图片和文案字段
alter table journals add column if not exists image_url text;
alter table journals add column if not exists literary_quote text;
alter table journals add column if not exists quote_source text;
