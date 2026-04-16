-- ================================================
-- 004 · Multi-location travel: segments + visit history
-- ================================================

-- 1. travel_segments — each leg of a multi-location trip
create table if not exists travel_segments (
  id               uuid primary key default gen_random_uuid(),
  travel_id        uuid not null references travels(id) on delete cascade,
  location_id      uuid not null references travel_locations(id),
  segment_order    int not null default 1,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_days    numeric(3,1) not null default 1.0,  -- 0.5, 1.0, 1.5, 2.0
  visit_count      int not null default 1,              -- nth visit to this location
  freshness_initial numeric(3,2) not null default 2.0
);

create index if not exists idx_segments_travel
  on travel_segments(travel_id, segment_order);

-- 2. location_visits — per-user visit counter
create table if not exists location_visits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  location_id     uuid not null references travel_locations(id) on delete cascade,
  visit_count     int not null default 1,
  last_visited_at timestamptz not null default now(),
  unique(user_id, location_id)
);

create index if not exists idx_location_visits_user
  on location_visits(user_id);

-- 3. Add current_segment_order to travels
alter table travels
  add column if not exists current_segment_order int not null default 1;

-- 4. Add segment_id to journals (nullable for backward compat)
alter table journals
  add column if not exists segment_id uuid references travel_segments(id);

-- 5. RLS
alter table travel_segments enable row level security;
alter table location_visits enable row level security;

-- travel_segments: user can read/write via travel ownership
drop policy if exists "segments_select" on travel_segments;
create policy "segments_select" on travel_segments
  for select using (
    exists (select 1 from travels where travels.id = travel_segments.travel_id and travels.user_id = auth.uid())
  );
drop policy if exists "segments_insert" on travel_segments;
create policy "segments_insert" on travel_segments
  for insert with check (
    exists (select 1 from travels where travels.id = travel_segments.travel_id and travels.user_id = auth.uid())
  );
drop policy if exists "segments_update" on travel_segments;
create policy "segments_update" on travel_segments
  for update using (
    exists (select 1 from travels where travels.id = travel_segments.travel_id and travels.user_id = auth.uid())
  );

-- location_visits: user reads/writes own
drop policy if exists "location_visits_select_own" on location_visits;
create policy "location_visits_select_own" on location_visits
  for select using (user_id = auth.uid());
drop policy if exists "location_visits_upsert_own" on location_visits;
create policy "location_visits_upsert_own" on location_visits
  for insert with check (user_id = auth.uid());
drop policy if exists "location_visits_update_own" on location_visits;
create policy "location_visits_update_own" on location_visits
  for update using (user_id = auth.uid());
