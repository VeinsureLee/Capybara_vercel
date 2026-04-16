# Multi-Location Travel ("Boredom" Mechanic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow capybara to visit multiple locations in a single trip (1-5 day budget), with stay duration at each location determined by a "freshness" algorithm that factors in historical visit counts.

**Architecture:** A single trip (`travels` row) now contains multiple ordered segments (`travel_segments` rows), each referencing a different location. When polling detects the current segment has expired, it auto-selects the next location using intent-weighted region-aware scoring. A `location_visits` table tracks per-user visit history to drive the freshness decay formula. Journals link to segments so each day's narrative reflects the correct location.

**Tech Stack:** Supabase PostgreSQL (new tables + migration), Next.js API routes, TypeScript

---

### Task 1: Database Migration — New Tables + Schema Changes

**Files:**
- Create: `supabase/migrations/004_multi_location_travel.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste and run the migration SQL. Verify tables `travel_segments` and `location_visits` exist, and columns `current_segment_order` on `travels` and `segment_id` on `journals` are added.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_multi_location_travel.sql
git commit -m "feat: add migration for multi-location travel segments + visit history"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add TravelSegment and LocationVisit interfaces, update Travel**

Add after the existing `Travel` interface (around line 201):

```typescript
/** 旅行分段 — 一次旅行中的单个地点停留 */
export interface TravelSegment {
  id: string
  travel_id: string
  location_id: string
  segment_order: number
  started_at: string
  ended_at?: string | null
  /** 在该地点停留的天数（0.5 / 1.0 / 1.5 / 2.0） */
  duration_days: number
  /** 这是第几次来这个地点 */
  visit_count: number
  /** 初始新鲜感值 */
  freshness_initial: number
  /** join 的地点信息 */
  travel_locations?: { name: string; region: string; description: string } | null
}

/** 用户对某地点的历史访问记录 */
export interface LocationVisitRecord {
  user_id: string
  location_id: string
  visit_count: number
  last_visited_at: string
}
```

Update the existing `Travel` interface to add `current_segment_order`:

```typescript
/** 一次多日旅行记录（替代 V1 的 Exploration） */
export interface Travel {
  id: string
  capybara_id: string
  user_id: string
  status: 'traveling' | 'completed'
  location_id: string
  duration_days: number
  intent_keywords: string[]
  matched_user_id?: string | null
  items_found?: ExplorationItem[]
  story?: string
  started_at: string
  estimated_return: string
  completed_at?: string
  /** 当前正在进行的分段序号 */
  current_segment_order?: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TravelSegment + LocationVisitRecord types"
```

---

### Task 3: Freshness Algorithm + Next Location Selector

**Files:**
- Create: `src/lib/travel/freshness.ts`
- Modify: `src/lib/travel/locations.ts` (add region adjacency map + `selectNextLocation`)

- [ ] **Step 1: Create freshness.ts — stay duration calculator**

```typescript
/**
 * 新鲜感算法：根据历史访问次数计算在某地点的停留天数
 *
 * base_stay = 2.0 天
 * visit_penalty = visit_count × 0.5 天
 * stay = max(0.5, base_stay - visit_penalty)
 *
 * 第1次: 1.5天, 第2次: 1.0天, 第3次: 0.5天, 第4次+: 0.5天
 */

const BASE_STAY = 2.0
const VISIT_PENALTY = 0.5
const MIN_STAY = 0.5

/**
 * 计算在某地点的停留天数
 * @param visitCount 历史访问次数（本次算第 visitCount 次）
 * @returns 停留天数（0.5 的倍数）
 */
export function calculateStayDuration(visitCount: number): number {
  const raw = BASE_STAY - visitCount * VISIT_PENALTY
  // 取整到 0.5 的倍数
  const rounded = Math.round(Math.max(MIN_STAY, raw) * 2) / 2
  return rounded
}

/**
 * 计算初始新鲜感值（与 visitCount 反相关）
 */
export function calculateFreshness(visitCount: number): number {
  return Math.max(MIN_STAY, BASE_STAY - visitCount * VISIT_PENALTY)
}
```

- [ ] **Step 2: Add region adjacency map and selectNextLocation to locations.ts**

Add at the end of `src/lib/travel/locations.ts`:

```typescript
/**
 * 区域邻近关系映射 — 用于多地点旅行时优先选同区域/邻近区域的下一站
 * key: region 前缀（取 region.split('·')[0]），value: 邻近区域前缀列表
 */
const REGION_ADJACENCY: Record<string, string[]> = {
  '中国': ['日本', '泰国', '越南', '柬埔寨', '马来西亚', '印尼', '尼泊尔'],
  '日本': ['中国'],
  '泰国': ['越南', '柬埔寨', '马来西亚', '中国'],
  '越南': ['泰国', '柬埔寨', '中国'],
  '柬埔寨': ['泰国', '越南'],
  '马来西亚': ['泰国', '印尼'],
  '印尼': ['马来西亚'],
  '捷克': ['瑞士', '法国', '意大利', '挪威', '冰岛', '希腊'],
  '希腊': ['意大利', '土耳其', '捷克'],
  '瑞士': ['法国', '意大利', '捷克', '挪威'],
  '法国': ['瑞士', '意大利', '捷克'],
  '冰岛': ['挪威', '捷克'],
  '挪威': ['冰岛', '瑞士', '捷克'],
  '意大利': ['法国', '瑞士', '希腊', '捷克'],
  '摩洛哥': ['法国', '捷克'],
  '土耳其': ['希腊'],
  '新西兰': ['加拿大', '美国'],
  '尼泊尔': ['中国'],
  '马达加斯加': ['肯尼亚'],
  '肯尼亚': ['马达加斯加'],
  '加拿大': ['美国'],
  '美国': ['加拿大'],
}

/**
 * 获取地点的国家/区域前缀
 * "中国·云南" → "中国", "印尼·巴厘岛" → "印尼", "冰岛" → "冰岛"
 */
function getRegionPrefix(region: string): string {
  return region.split('·')[0]
}

/**
 * 判断两个地点是否在同区域
 */
function isSameRegion(regionA: string, regionB: string): boolean {
  return getRegionPrefix(regionA) === getRegionPrefix(regionB)
}

/**
 * 判断两个地点是否在邻近区域
 */
function isAdjacentRegion(regionA: string, regionB: string): boolean {
  const prefA = getRegionPrefix(regionA)
  const prefB = getRegionPrefix(regionB)
  return REGION_ADJACENCY[prefA]?.includes(prefB) ?? false
}

/**
 * 为多地点旅行选择下一个地点
 *
 * @param currentRegion 当前地点的 region
 * @param intents 用户意向词（短期+长期加权合并后的 top 8）
 * @param excludeNames 本次旅行已去过的地点名
 * @param visitCounts 用户的历史访问次数 map（location_name → count）
 * @returns 选中的地点
 */
export function selectNextLocation(
  currentRegion: string,
  intents: string[],
  excludeNames: string[],
  visitCounts: Record<string, number>
): LocationEntry {
  // 排除本次旅行已去过的地点
  const available = LOCATION_DB.filter((loc) => !excludeNames.includes(loc.name))
  if (available.length === 0) {
    return LOCATION_DB[Math.floor(Math.random() * LOCATION_DB.length)]
  }

  // 收集意向标签
  const targetTags = new Set<string>()
  for (const intent of intents) {
    for (const [key, tags] of Object.entries(INTENT_TAG_MAP)) {
      if (intent.includes(key)) {
        tags.forEach((t) => targetTags.add(t))
      }
    }
    targetTags.add(intent)
  }

  // 评分
  const scored = available.map((loc) => {
    // 意向匹配分（0-1）
    const tagHits = targetTags.size > 0
      ? loc.tags.filter((t) => targetTags.has(t)).length / Math.max(targetTags.size, 1)
      : 0

    // 区域加分
    let regionBonus = 0
    if (isSameRegion(loc.region, currentRegion)) {
      regionBonus = 0.3
    } else if (isAdjacentRegion(loc.region, currentRegion)) {
      regionBonus = 0.15
    }

    // 新奇加分（基于历史访问次数）
    const visits = visitCounts[loc.name] ?? 0
    const noveltyBonus = visits === 0 ? 0.2 : visits === 1 ? 0.1 : 0

    const finalScore = tagHits + regionBonus + noveltyBonus
    return { loc, score: finalScore }
  })

  scored.sort((a, b) => b.score - a.score)

  // 从 top-5 中随机选
  const top = scored.slice(0, Math.min(5, scored.length))
  return top[Math.floor(Math.random() * top.length)].loc
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/travel/freshness.ts src/lib/travel/locations.ts
git commit -m "feat: add freshness algorithm + region-aware next location selector"
```

---

### Task 4: Intent Aggregation Helper (Short-term + Long-term)

**Files:**
- Create: `src/lib/travel/intents.ts`

- [ ] **Step 1: Create the intent aggregation function**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 聚合用户的短期+长期意向词
 * 短期（最近10条对话）权重高，长期（最近50条）权重低
 * 返回 top 8 意向词
 */
export async function aggregateIntents(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('keywords')
    .eq('user_id', userId)
    .not('keywords', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const keywordWeights: Record<string, number> = {}

  ;(recentConvos || []).forEach((conv, i) => {
    const kws = conv.keywords as string[]
    if (!kws) return

    // 短期（前10条）权重 = 1.0 - i*0.05，长期（10-50条）权重 = 0.3 - (i-10)*0.005
    let weight: number
    if (i < 10) {
      weight = 1.0 - i * 0.05  // 1.0 → 0.55
    } else {
      weight = Math.max(0.05, 0.3 - (i - 10) * 0.005)  // 0.3 → 0.1
    }

    kws.forEach((kw) => {
      keywordWeights[kw] = (keywordWeights[kw] || 0) + weight
    })
  })

  return Object.entries(keywordWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([kw]) => kw)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/travel/intents.ts
git commit -m "feat: add short-term + long-term intent aggregation"
```

---

### Task 5: Refactor POST /api/travel — Start Travel with First Segment

**Files:**
- Modify: `src/app/api/travel/route.ts` (POST handler)

- [ ] **Step 1: Update POST handler to create first segment + record visit**

Replace the POST handler in `src/app/api/travel/route.ts` (lines 138-280):

```typescript
/**
 * POST /api/travel - 发起新旅行（多地点版本）
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 解析请求体，获取用户手动选择的地点（可选）
  let requestedLocationName: string | undefined
  try {
    const body = await req.json()
    requestedLocationName = body.location_name
  } catch {
    // body 为空或解析失败，忽略
  }

  // 1. 确认卡皮在家
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) return NextResponse.json({ error: 'No capybara' }, { status: 404 })
  if (capybara.status !== 'home' && capybara.status !== 'resting') {
    return NextResponse.json({ error: '卡皮巴拉还在外面呢~' }, { status: 400 })
  }

  // 2. 聚合意向词（短期+长期）
  const intents = await aggregateIntents(supabase, user.id)

  // 3. 冷却期内去过的地点
  const cutoff = new Date(Date.now() - LOCATION_COOLDOWN_MS).toISOString()
  const { data: recentTravels } = await supabase
    .from('travels')
    .select('story')
    .eq('user_id', user.id)
    .gte('started_at', cutoff)

  // 4. ~10% 概率卡皮拒绝出发
  if (Math.random() < 0.1) {
    const refusals = [
      '不想去……今天想泡水',
      '*翻了个身* 累了',
      '嗯…改天吧',
      '*打了个哈欠* 现在不想动',
    ]
    return NextResponse.json({
      refused: true,
      message: refusals[Math.floor(Math.random() * refusals.length)],
    })
  }

  // 5. 查询历史访问次数
  const { data: visitRecords } = await supabase
    .from('location_visits')
    .select('location_id, visit_count, travel_locations(name)')
    .eq('user_id', user.id)

  const visitCounts: Record<string, number> = {}
  ;(visitRecords ?? []).forEach((r: Record<string, unknown>) => {
    const loc = r.travel_locations as { name: string } | null
    if (loc) visitCounts[loc.name] = r.visit_count as number
  })

  // 6. 选出发地点 + 总行程天数
  const excludeNames = (recentTravels ?? []).map((t) => t.story).filter(Boolean) as string[]
  const manualLocation = requestedLocationName
    ? LOCATION_DB.find((loc) => loc.name === requestedLocationName)
    : undefined
  const location = manualLocation ?? selectLocation(intents, excludeNames)
  const totalDurationDays = randomTravelDuration()

  // 7. 计算第一段的停留天数（基于新鲜感）
  const firstVisitCount = (visitCounts[location.name] ?? 0) + 1
  const firstStayDays = Math.min(calculateStayDuration(firstVisitCount), totalDurationDays)

  // 总旅行时间
  const totalDurationMs = totalDurationDays * MS_PER_DAY
  const estimatedReturn = new Date(Date.now() + totalDurationMs).toISOString()

  // 8. 确保地点存在于 travel_locations 表
  let { data: locRow } = await supabase
    .from('travel_locations')
    .select('id')
    .eq('name', location.name)
    .single()

  if (!locRow) {
    const { data: newLoc, error: locErr } = await supabase
      .from('travel_locations')
      .insert({
        name: location.name,
        region: location.region,
        tags: location.tags,
        description: location.description,
        visual_keywords: location.visual_keywords,
      })
      .select('id')
      .single()
    if (locErr) {
      console.error('Insert travel_location error:', locErr.message)
    }
    locRow = newLoc
  }

  // 9. 创建旅行记录
  const { data: travel, error } = await supabase
    .from('travels')
    .insert({
      capybara_id: capybara.id,
      user_id: user.id,
      status: 'traveling',
      location_id: locRow?.id,
      duration_days: totalDurationDays,
      intent_keywords: intents,
      started_at: new Date().toISOString(),
      estimated_return: estimatedReturn,
      current_segment_order: 1,
    })
    .select()
    .single()

  if (error) {
    console.error('Create travel error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 10. 创建第一个 segment
  const firstSegmentEnd = new Date(Date.now() + firstStayDays * MS_PER_DAY).toISOString()
  await supabase.from('travel_segments').insert({
    travel_id: travel.id,
    location_id: locRow?.id,
    segment_order: 1,
    started_at: new Date().toISOString(),
    ended_at: firstSegmentEnd,
    duration_days: firstStayDays,
    visit_count: firstVisitCount,
    freshness_initial: calculateFreshness(firstVisitCount),
  })

  // 11. 更新 location_visits（upsert）
  await supabase.from('location_visits').upsert(
    {
      user_id: user.id,
      location_id: locRow?.id,
      visit_count: firstVisitCount,
      last_visited_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,location_id' }
  )

  // 12. 更新卡皮状态
  await supabase
    .from('capybaras')
    .update({ status: 'traveling' })
    .eq('id', capybara.id)

  return NextResponse.json({
    travel,
    location,
    duration_days: totalDurationDays,
    estimated_return: estimatedReturn,
    first_stay_days: firstStayDays,
    departure_message: `${capybara.name}想去${location.name}看看……明天就出发`,
  })
}
```

Also add the new imports at the top of the file:

```typescript
import { aggregateIntents } from '@/lib/travel/intents'
import { calculateStayDuration, calculateFreshness } from '@/lib/travel/freshness'
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/travel/route.ts
git commit -m "feat: POST /api/travel creates first segment + records visit count"
```

---

### Task 6: Refactor GET /api/travel — Segment Transition Logic

**Files:**
- Modify: `src/app/api/travel/route.ts` (GET handler)

- [ ] **Step 1: Update GET handler with segment-aware lazy completion**

Replace the GET handler (lines 9-133) with:

```typescript
/**
 * GET /api/travel - 查询当前旅行状态（含段落跳转 + 懒完成）
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 懒检查：休息期是否结束
  const { data: capybaraCheck, error: capyErr } = await supabase
    .from('capybaras')
    .select('status, rest_until')
    .eq('owner_id', user.id)
    .single()

  if (capyErr) {
    if (capyErr.message?.includes('rest_until')) {
      const { data: fallback } = await supabase
        .from('capybaras')
        .select('status')
        .eq('owner_id', user.id)
        .single()
      if (fallback && fallback.status !== 'home' && fallback.status !== 'traveling') {
        await supabase.from('capybaras').update({ status: 'home' }).eq('owner_id', user.id)
        return NextResponse.json({ travel: null, capybara_status: 'home' })
      }
    }
  }

  if (
    capybaraCheck?.status === 'resting' &&
    capybaraCheck.rest_until &&
    new Date(capybaraCheck.rest_until) <= new Date()
  ) {
    await supabase
      .from('capybaras')
      .update({ status: 'home', rest_until: null })
      .eq('owner_id', user.id)
    return NextResponse.json({ travel: null, just_rested: true, capybara_status: 'home' })
  }

  if (capybaraCheck?.status === 'resting') {
    return NextResponse.json({
      travel: null,
      capybara_status: 'resting',
      rest_until: capybaraCheck.rest_until,
    })
  }

  // 查询当前旅行
  const { data: travel, error: travelErr } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description)')
    .eq('user_id', user.id)
    .eq('status', 'traveling')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!travel) {
    if (capybaraCheck?.status === 'traveling') {
      await supabase
        .from('capybaras')
        .update({ status: 'home', rest_until: null })
        .eq('owner_id', user.id)
      return NextResponse.json({ travel: null, capybara_status: 'home' })
    }
    return NextResponse.json({ travel: null, capybara_status: capybaraCheck?.status ?? 'home' })
  }

  // 查询当前 segment
  const { data: currentSegment } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description)')
    .eq('travel_id', travel.id)
    .eq('segment_order', travel.current_segment_order ?? 1)
    .single()

  // 查询所有 segments（用于前端展示）
  const { data: allSegments } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description)')
    .eq('travel_id', travel.id)
    .order('segment_order', { ascending: true })

  const nowMs = Date.now()

  // === 整个旅行结束检查 ===
  const returnTime = new Date(travel.estimated_return).getTime()
  if (nowMs >= returnTime) {
    // 结束当前 segment
    if (currentSegment && !currentSegment.ended_at) {
      await supabase
        .from('travel_segments')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', currentSegment.id)
    }

    const restDays = randomRestDays()
    const restUntil = new Date(Date.now() + restDays * MS_PER_DAY).toISOString()

    await supabase
      .from('travels')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', travel.id)

    await supabase
      .from('capybaras')
      .update({
        status: 'resting',
        last_travel_completed_at: new Date().toISOString(),
        rest_until: restUntil,
      })
      .eq('owner_id', user.id)

    return NextResponse.json({
      travel: { ...travel, status: 'completed', completed_at: new Date().toISOString() },
      segments: allSegments ?? [],
      just_completed: true,
      rest_until: restUntil,
    })
  }

  // === 当前 segment 到期 → 跳转下一地点 ===
  if (currentSegment?.ended_at && nowMs >= new Date(currentSegment.ended_at).getTime()) {
    // 计算剩余行程预算
    const elapsedMs = nowMs - new Date(travel.started_at).getTime()
    const elapsedDays = elapsedMs / MS_PER_DAY
    const remainingDays = travel.duration_days - elapsedDays

    if (remainingDays >= 0.5) {
      // 选下一个地点
      const intents = await aggregateIntents(supabase, user.id)

      // 获取本次旅行已去过的地点名
      const visitedNames = (allSegments ?? []).map((s: Record<string, unknown>) => {
        const loc = s.travel_locations as { name: string } | null
        return loc?.name
      }).filter(Boolean) as string[]

      // 获取用户历史访问次数
      const { data: visitRecords } = await supabase
        .from('location_visits')
        .select('location_id, visit_count, travel_locations(name)')
        .eq('user_id', user.id)

      const visitCounts: Record<string, number> = {}
      ;(visitRecords ?? []).forEach((r: Record<string, unknown>) => {
        const loc = r.travel_locations as { name: string } | null
        if (loc) visitCounts[loc.name] = r.visit_count as number
      })

      const currentLocRegion = (currentSegment.travel_locations as { region: string } | null)?.region ?? ''
      const nextLoc = selectNextLocation(currentLocRegion, intents, visitedNames, visitCounts)

      // 确保地点存在于 DB
      let { data: nextLocRow } = await supabase
        .from('travel_locations')
        .select('id')
        .eq('name', nextLoc.name)
        .single()

      if (!nextLocRow) {
        const { data: newLoc } = await supabase
          .from('travel_locations')
          .insert({
            name: nextLoc.name,
            region: nextLoc.region,
            tags: nextLoc.tags,
            description: nextLoc.description,
            visual_keywords: nextLoc.visual_keywords,
          })
          .select('id')
          .single()
        nextLocRow = newLoc
      }

      // 计算新段停留天数
      const nextVisitCount = (visitCounts[nextLoc.name] ?? 0) + 1
      const nextStayDays = Math.min(calculateStayDuration(nextVisitCount), remainingDays)
      const nextSegmentOrder = (travel.current_segment_order ?? 1) + 1

      const segmentStart = new Date().toISOString()
      const segmentEnd = new Date(Date.now() + nextStayDays * MS_PER_DAY).toISOString()

      // 创建新 segment
      await supabase.from('travel_segments').insert({
        travel_id: travel.id,
        location_id: nextLocRow?.id,
        segment_order: nextSegmentOrder,
        started_at: segmentStart,
        ended_at: segmentEnd,
        duration_days: nextStayDays,
        visit_count: nextVisitCount,
        freshness_initial: calculateFreshness(nextVisitCount),
      })

      // 更新 travels
      await supabase
        .from('travels')
        .update({ current_segment_order: nextSegmentOrder })
        .eq('id', travel.id)

      // 更新 location_visits
      await supabase.from('location_visits').upsert(
        {
          user_id: user.id,
          location_id: nextLocRow?.id,
          visit_count: nextVisitCount,
          last_visited_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,location_id' }
      )

      // 重新查询最新状态
      const { data: updatedSegments } = await supabase
        .from('travel_segments')
        .select('*, travel_locations(name, region, description)')
        .eq('travel_id', travel.id)
        .order('segment_order', { ascending: true })

      const { data: journals } = await supabase
        .from('journals')
        .select('*')
        .eq('travel_id', travel.id)
        .order('day_number', { ascending: true })

      return NextResponse.json({
        travel: { ...travel, current_segment_order: nextSegmentOrder },
        segments: updatedSegments ?? [],
        current_segment: updatedSegments?.find((s: Record<string, unknown>) => s.segment_order === nextSegmentOrder),
        journals: journals ?? [],
        just_moved: true,
        moved_to: nextLoc.name,
      })
    }
    // 剩余预算不足 0.5 天，提前结束旅行
    // （让下次 poll 触发整体完成）
  }

  // === 正常状态：返回当前信息 ===
  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('travel_id', travel.id)
    .order('day_number', { ascending: true })

  return NextResponse.json({
    travel,
    segments: allSegments ?? [],
    current_segment: currentSegment,
    journals: journals ?? [],
  })
}
```

- [ ] **Step 2: Add new imports at top of file**

Ensure these imports are present at the top of the file:

```typescript
import { selectNextLocation } from '@/lib/travel/locations'
import { aggregateIntents } from '@/lib/travel/intents'
import { calculateStayDuration, calculateFreshness } from '@/lib/travel/freshness'
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/travel/route.ts
git commit -m "feat: GET /api/travel handles segment transitions + multi-location jumps"
```

---

### Task 7: Update Journal Generation for Segment Awareness

**Files:**
- Modify: `src/app/api/journal/route.ts`

- [ ] **Step 1: Update POST handler to use current segment's location**

Key changes to the POST handler:
1. After getting the travel, also query the current segment
2. Use the segment's location (not the travel's original location) for journal content
3. Calculate day_number relative to segment start
4. Add segment_id to the journal insert
5. For transition days, add a narrative hint about "getting bored" / "moving on"

Replace the POST handler with:

```typescript
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let expectedDay: number | undefined
  try {
    const body = await req.json()
    expectedDay = body.expected_day
  } catch { /* empty body is ok */ }

  // 1. 获取当前旅行
  const { data: travel } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description, tags)')
    .eq('user_id', user.id)
    .eq('status', 'traveling')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!travel) {
    return NextResponse.json({ error: '当前没有进行中的旅行' }, { status: 400 })
  }

  // 2. 获取当前 segment（如果有的话）
  const segmentOrder = travel.current_segment_order ?? 1
  const { data: currentSegment } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description, tags)')
    .eq('travel_id', travel.id)
    .eq('segment_order', segmentOrder)
    .single()

  // 使用 segment 的地点信息（如果存在），否则 fallback 到 travel 的地点
  const segmentLocation = currentSegment?.travel_locations as { name: string; region: string; description: string } | null
  const travelLocation = travel.travel_locations as { name: string; region: string; description: string } | null
  const location = segmentLocation ?? travelLocation

  // 3. 计算今天是第几天（相对于整个旅行）
  const startDate = new Date(travel.started_at)
  const now = new Date()
  const dayNumber = Math.min(
    Math.floor((now.getTime() - startDate.getTime()) / MS_PER_DAY) + 1,
    travel.duration_days
  )

  if (expectedDay !== undefined && expectedDay !== dayNumber) {
    return NextResponse.json(
      { error: '天数不一致，请刷新页面', code: 'DAY_CONFLICT', server_day: dayNumber },
      { status: 409 }
    )
  }

  // 检查今天是否已生成
  const { data: existing } = await supabase
    .from('journals')
    .select('id')
    .eq('travel_id', travel.id)
    .eq('day_number', dayNumber)
    .single()

  if (existing) {
    return NextResponse.json({ error: '今日手记已生成', journal_id: existing.id }, { status: 409 })
  }

  // 4. 获取卡皮信息
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('name, traits')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) return NextResponse.json({ error: 'No capybara' }, { status: 404 })

  // 5. 匹配信息
  const hasEncounter = !!travel.matched_user_id
  let encounterTopics: string[] = []
  let encounterScore = 0

  if (hasEncounter && travel.matched_user_id) {
    const { data: matchedMemories } = await supabase
      .from('memories')
      .select('topic')
      .eq('user_id', travel.matched_user_id)
      .eq('shareable', true)
      .limit(5)
    encounterTopics = (matchedMemories ?? []).map((m) => m.topic)
    encounterScore = Math.min(encounterTopics.length * 0.2, 1)
  }

  // 6. 判断是否是该段的最后一天（用于叙事暗示）
  let isLastDayOfSegment = false
  if (currentSegment?.ended_at) {
    const segEndMs = new Date(currentSegment.ended_at).getTime()
    const nextDayMs = new Date(travel.started_at).getTime() + dayNumber * MS_PER_DAY
    isLastDayOfSegment = nextDayMs >= segEndMs
  }

  // 判断是否是该段的第一天（刚到新地点）
  let isFirstDayOfSegment = false
  if (currentSegment && segmentOrder > 1) {
    const segStartMs = new Date(currentSegment.started_at).getTime()
    const thisDayStartMs = new Date(travel.started_at).getTime() + (dayNumber - 1) * MS_PER_DAY
    isFirstDayOfSegment = thisDayStartMs >= segStartMs &&
      thisDayStartMs < segStartMs + MS_PER_DAY
  }

  // 7. 生成手记
  const intents = (travel.intent_keywords as string[]) ?? []

  // 计算在当前段的天数（用于叙事进展感）
  const segmentDayNumber = currentSegment
    ? Math.max(1, Math.floor((now.getTime() - new Date(currentSegment.started_at).getTime()) / MS_PER_DAY) + 1)
    : dayNumber
  const segmentTotalDays = currentSegment?.duration_days ?? travel.duration_days

  const prompt = journalPrompt({
    capybaraName: capybara.name,
    locationName: location?.name ?? '未知地点',
    locationDescription: location?.description ?? '',
    dayNumber: segmentDayNumber,
    totalDays: Math.ceil(segmentTotalDays),
    traits: (capybara.traits as string[]) ?? [],
    hasEncounter: hasEncounter && dayNumber >= 2,
    encounterTopics,
    encounterScore,
    intents,
    isFirstDayOfSegment,
    isLastDayOfSegment,
  })

  const aiResult = await callAI('你是旅行手记生成器，只输出 JSON。', prompt)

  let narrative = `${capybara.name}在${location?.name ?? '远方'}度过了安静的一天。看了看天，打了个哈欠。`
  let encounterNarrative: string | null = null
  let dailyItem = null
  let visualHighlights = null

  if (aiResult) {
    try {
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        narrative = parsed.narrative ?? narrative
        encounterNarrative = parsed.encounter_narrative ?? null
        dailyItem = parsed.daily_item ?? null
        if (Array.isArray(parsed.visual_highlights)) {
          visualHighlights = parsed.visual_highlights.slice(0, 2)
        }
      }
    } catch { /* fallback */ }
  }

  // 8. 保存手记
  const baseRow = {
    travel_id: travel.id,
    user_id: user.id,
    day_number: dayNumber,
    location_name: location?.name ?? '未知地点',
    narrative,
    encounter_narrative: encounterNarrative,
    encounter_user_id: hasEncounter ? travel.matched_user_id : null,
    encounter_score: encounterScore > 0 ? encounterScore : null,
    daily_item: dailyItem,
    segment_id: currentSegment?.id ?? null,
  }

  const rowWithHighlights = visualHighlights
    ? { ...baseRow, visual_highlights: visualHighlights }
    : baseRow

  let { data: journal, error } = await supabase
    .from('journals')
    .insert(rowWithHighlights)
    .select()
    .single()

  if (error?.code === 'PGRST204' && error.message?.includes('visual_highlights')) {
    const fallback = await supabase
      .from('journals')
      .insert(baseRow)
      .select()
      .single()
    journal = fallback.data
    error = fallback.error
  }

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '今日手记已生成（并发冲突）' }, { status: 409 })
    }
    console.error('Create journal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 9. 物品追加
  if (dailyItem) {
    const currentItems = (travel.items_found as unknown[]) ?? []
    await supabase
      .from('travels')
      .update({ items_found: [...currentItems, dailyItem] })
      .eq('id', travel.id)
  }

  return NextResponse.json({ journal })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/journal/route.ts
git commit -m "feat: journal generation uses current segment location + transition hints"
```

---

### Task 8: Update Journal Prompt for Segment Transitions

**Files:**
- Modify: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Add isFirstDayOfSegment / isLastDayOfSegment params to journalPrompt**

Update the `journalPrompt` function parameters and body:

```typescript
export function journalPrompt(params: {
  capybaraName: string
  locationName: string
  locationDescription: string
  dayNumber: number
  totalDays: number
  traits: string[]
  hasEncounter: boolean
  encounterTopics?: string[]
  encounterScore?: number
  intents: string[]
  /** 刚到一个新地点（多地点旅行中转站） */
  isFirstDayOfSegment?: boolean
  /** 即将离开当前地点（腻了，要跳到下一站） */
  isLastDayOfSegment?: boolean
}) {
  const encounterSection = params.hasEncounter
    ? `\n\n今天遇到了另一只旅伴卡皮。它的主人和你的主人有相似的经历，共振主题：${params.encounterTopics?.join('、')}。
请在手记中自然地融入这次相遇——两只卡皮是怎么注意到对方的、怎么试探着接近、交换了什么故事（只说主题，不露具体细节）。
相似度${(params.encounterScore ?? 0) > 0.5 ? '很高' : '一般'}，${(params.encounterScore ?? 0) > 0.5 ? '相遇段落要有情感深度，让读者被击中' : '相遇段落保持轻盈温暖'}。`
    : ''

  // 多地点旅行的叙事引导
  let transitionHint = ''
  if (params.isFirstDayOfSegment) {
    transitionHint = '\n\n【重要】今天是刚到这个新地点的第一天。叙事中要自然地体现"从上一个地方出发，来到了这里"的感觉——新鲜、好奇、比较着和之前不同的风景。'
  }
  if (params.isLastDayOfSegment) {
    transitionHint = '\n\n【重要】卡皮在这个地方待得差不多了，开始有点腻了。叙事中要自然地体现"这里虽然好，但想去别的地方看看了"的心情——不是不喜欢，而是好奇心在召唤。'
  }

  return `你是卡皮巴拉"${params.capybaraName}"的旅行手记生成器。

地点：${params.locationName}
地点描述：${params.locationDescription}
旅行第 ${params.dayNumber} 天（共 ${params.totalDays} 天）
卡皮性格：${params.traits.join('、')}
主人最近的兴趣方向：${params.intents.join('、') || '随便逛逛'}${encounterSection}${transitionHint}

请生成今日手记，严格 JSON 格式：
{
  "narrative": "今日叙事（80-180字，以卡皮视角讲述，温暖治愈，有画面感，体现地点的具体细节）",
  ${params.hasEncounter ? '"encounter_narrative": "相遇段落（60-120字，自然融入叙事，主题级披露不露具体细节）",' : ''}
  "daily_item": {
    "name": "今日发现的小物件名",
    "description": "物件描述（15字以内）",
    "category": "decoration/plant/collectible/interactive",
    "rarity": "${params.dayNumber === params.totalDays ? '可以是 rare 或 legendary' : 'common 或 uncommon'}"
  },
  "visual_highlights": [
    {
      "keyword": "叙事中最有画面感的关键词（如绿叶、贝壳、石灯笼等）",
      "description": "对这个元素的一句话描写（15字以内）",
      "suggested_position": "top-left/top-center/top-right/left-center/center/right-center/bottom-left/bottom-center/bottom-right 中选一个最适合在地点照片上标注的位置"
    }
  ]
}

visual_highlights 规则：
- 返回 1-2 个最具画面感的关键词，用于在地点照片上做标注展示
- keyword 必须是叙事中提到的具体事物（植物、动物、建筑元素等），不要抽象概念
- suggested_position 根据该事物在真实场景中可能出现的位置来选择

叙事原则：
- 第${params.dayNumber}天的内容应体现旅程的进展感（第1天=新鲜好奇，中间=深入探索，最后一天=不舍离开）
- 不要写成流水账，要有一个小小的情绪弧线
- 用卡皮的语气：短句、画面感、偶尔跑题关注小东西`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat: journal prompt supports segment transition narrative hints"
```

---

### Task 9: Update Travel Detail API for Segments

**Files:**
- Modify: `src/app/api/travel/[id]/route.ts`

- [ ] **Step 1: Return segments data in travel detail API**

Update the GET handler to also return segments:

```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: travel, error } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description, tags, visual_keywords)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !travel) {
    return NextResponse.json({ error: '旅行记录不存在' }, { status: 404 })
  }

  // 查询 segments
  const { data: segments } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description)')
    .eq('travel_id', id)
    .order('segment_order', { ascending: true })

  // 从本地地点库补充 image URL
  const locData = travel.travel_locations as { name?: string } | null
  const localLoc = LOCATION_DB.find((l) => l.name === locData?.name)

  if (!travel.travel_locations) {
    const { data: firstJournal } = await supabase
      .from('journals')
      .select('location_name')
      .eq('travel_id', id)
      .limit(1)
      .single()

    const locName = firstJournal?.location_name
    const fallbackLoc = locName && locName !== '未知地点'
      ? LOCATION_DB.find((l) => l.name === locName)
      : null

    if (fallbackLoc) {
      travel.travel_locations = {
        name: fallbackLoc.name,
        region: fallbackLoc.region,
        description: fallbackLoc.description,
        tags: fallbackLoc.tags,
        visual_keywords: fallbackLoc.visual_keywords,
      }
    }
  }

  const matchedLoc = localLoc ?? LOCATION_DB.find(
    (l) => l.name === (travel.travel_locations as { name?: string } | null)?.name
  )
  const locationImage = matchedLoc?.image ?? null

  // 为每个 segment 附加 image URL
  const segmentsWithImages = (segments ?? []).map((seg: Record<string, unknown>) => {
    const segLoc = seg.travel_locations as { name?: string } | null
    const segLocalLoc = LOCATION_DB.find((l) => l.name === segLoc?.name)
    return { ...seg, location_image: segLocalLoc?.image ?? null }
  })

  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('travel_id', id)
    .eq('user_id', user.id)
    .order('day_number', { ascending: true })

  return NextResponse.json({
    travel,
    segments: segmentsWithImages,
    journals: journals ?? [],
    location_image: locationImage,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/travel/[id]/route.ts
git commit -m "feat: travel detail API returns segments with images"
```

---

### Task 10: Update Travel History API

**Files:**
- Modify: `src/app/api/travel/history/route.ts`

- [ ] **Step 1: Include segment count in history response**

After the `travelSummaries` mapping (around line 37), also query segment count:

```typescript
const travelSummaries = await Promise.all(
  (travels ?? []).map(async (t) => {
    const { count: journalCount } = await supabase
      .from('journals')
      .select('id', { count: 'exact', head: true })
      .eq('travel_id', t.id)

    const { count: segmentCount } = await supabase
      .from('travel_segments')
      .select('id', { count: 'exact', head: true })
      .eq('travel_id', t.id)

    const itemsFound = (t.items_found as unknown[]) ?? []
    const loc = t.travel_locations as unknown as { name: string; region: string } | null

    return {
      id: t.id,
      location_name: loc?.name ?? '未知地点',
      region: loc?.region ?? '',
      duration_days: t.duration_days,
      started_at: t.started_at,
      completed_at: t.completed_at,
      journal_count: journalCount ?? 0,
      item_count: itemsFound.length,
      segment_count: segmentCount ?? 1,
    }
  })
)
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/travel/history/route.ts
git commit -m "feat: travel history includes segment count"
```

---

### Task 11: Update Travel Page UI — Show Current Segment + Transitions

**Files:**
- Modify: `src/app/travel/page.tsx`

- [ ] **Step 1: Update TravelData interface and state**

Update the `TravelData` interface:

```typescript
interface TravelData {
  id: string
  status: string
  duration_days: number
  started_at: string
  estimated_return: string
  completed_at?: string
  current_segment_order?: number
  travel_locations?: { name: string; region: string; description: string } | null
}

interface SegmentData {
  id: string
  segment_order: number
  started_at: string
  ended_at?: string | null
  duration_days: number
  visit_count: number
  travel_locations?: { name: string; region: string; description: string } | null
  location_image?: string | null
}
```

Add state:

```typescript
const [segments, setSegments] = useState<SegmentData[]>([])
const [currentSegment, setCurrentSegment] = useState<SegmentData | null>(null)
const [justMoved, setJustMoved] = useState<string | null>(null)
```

- [ ] **Step 2: Update loadTravel to handle segments**

```typescript
const loadTravel = useCallback(async () => {
  const res = await fetch('/api/travel')
  const data = await res.json()
  setTravel(data.travel)
  setJournals(data.journals ?? [])
  setSegments(data.segments ?? [])
  setCurrentSegment(data.current_segment ?? null)

  if (data.just_moved) {
    setJustMoved(data.moved_to)
    setTimeout(() => setJustMoved(null), 5000) // 5秒后消失
  }

  if (data.just_completed) {
    setJustCompleted(true)
    setResting(true)
    setRestUntil(data.rest_until ?? null)
  } else if (data.capybara_status === 'resting') {
    setResting(true)
    setRestUntil(data.rest_until ?? null)
  } else {
    setResting(false)
    setRestUntil(null)
    if (data.just_rested) setJustCompleted(false)
  }

  setLoading(false)
}, [])
```

- [ ] **Step 3: Update the travel card to show current segment location**

Replace the travel card section (lines 258-319) to use `currentSegment`:

```typescript
{travel && travel.status === 'traveling' && (
  <div className="p-4 bg-gradient-to-br from-river-50 to-meadow-50 rounded-2xl border border-river-100">
    {/* 跳转提示 */}
    {justMoved && (
      <div className="mb-3 p-2 bg-meadow-100 rounded-lg text-center">
        <p className="text-xs text-meadow-700">🦫 卡皮觉得待够了，跑去了 {justMoved}！</p>
      </div>
    )}

    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">🦫</span>
      <div>
        <p className="font-semibold text-gray-800 text-sm">
          {currentSegment?.travel_locations?.name ?? locationName}
        </p>
        <p className="text-xs text-gray-500">
          {currentSegment?.travel_locations?.region ?? travel.travel_locations?.region}
          {currentSegment && currentSegment.visit_count > 1 && (
            <span className="ml-1 text-amber-500">（第{currentSegment.visit_count}次来）</span>
          )}
        </p>
      </div>
    </div>
    <p className="text-xs text-gray-600 mb-3">
      {currentSegment?.travel_locations?.description ?? travel.travel_locations?.description}
    </p>

    {/* 旅行路线 */}
    {segments.length > 1 && (
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
        {segments.map((seg, i) => {
          const segLoc = seg.travel_locations as { name: string } | null
          const isCurrent = seg.segment_order === (travel.current_segment_order ?? 1)
          return (
            <div key={seg.id} className="flex items-center shrink-0">
              {i > 0 && <span className="text-gray-300 mx-0.5 text-[10px]">→</span>}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                isCurrent
                  ? 'bg-capybara-500 text-white'
                  : seg.ended_at ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-400'
              }`}>
                {segLoc?.name?.split('·')[0] ?? '?'}
              </span>
            </div>
          )
        })}
      </div>
    )}

    <ContinuousProgress
      startedAt={travel.started_at}
      estimatedReturn={travel.estimated_return}
      durationDays={travel.duration_days}
    />

    {isTesting && (
      <p className="text-[10px] text-river-400 mt-2">
        🛠 开发模式：1天 = 1分钟
      </p>
    )}

    {canGenerateJournal && (
      <button
        onClick={generateJournal}
        disabled={generatingJournal}
        className="w-full mt-3 py-2.5 bg-capybara-500 text-white rounded-xl text-sm font-medium
                   hover:bg-capybara-600 transition disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
      >
        {generatingJournal ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            正在生成手记...
          </>
        ) : (
          `生成今日手记 (第 ${journals.length + 1} 天)`
        )}
      </button>
    )}
    {journalError && (
      <p className="mt-2 text-xs text-amber-600 text-center">{journalError}</p>
    )}

    {journals.length > 0 && (
      <p className="mt-2 text-[11px] text-gray-400 text-center">
        已生成 {journals.length} 篇手记
        {travel && (
          <Link
            href={`/travel/${travel.id}`}
            className="text-capybara-500 ml-1 hover:underline"
          >
            查看详情 →
          </Link>
        )}
      </p>
    )}
  </div>
)}
```

- [ ] **Step 4: Update history items to show segment count**

In the history list item, after `{item.duration_days}天`:

```typescript
<p className="text-[11px] text-gray-500">
  {item.duration_days}天{item.segment_count > 1 ? ` · ${item.segment_count}站` : ''} · {item.journal_count}篇手记
</p>
```

Update the `TravelHistoryItem` interface to include `segment_count`:

```typescript
interface TravelHistoryItem {
  id: string
  location_name: string
  region: string
  duration_days: number
  started_at: string
  completed_at: string
  journal_count: number
  item_count: number
  segment_count: number
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/travel/page.tsx
git commit -m "feat: travel page shows current segment, route breadcrumbs, transition alerts"
```

---

### Task 12: Update Travel Detail Page for Multi-Location Display

**Files:**
- Modify: `src/app/travel/[id]/page.tsx`

- [ ] **Step 1: Add segments display and group journals by segment**

Add segment-related interfaces and state:

```typescript
interface SegmentDetail {
  id: string
  segment_order: number
  duration_days: number
  visit_count: number
  started_at: string
  ended_at?: string | null
  travel_locations?: { name: string; region: string; description: string } | null
  location_image?: string | null
}
```

Add state: `const [segments, setSegments] = useState<SegmentDetail[]>([])`.

Update `loadDetail` to include segments:

```typescript
const loadDetail = useCallback(async () => {
  const res = await fetch(`/api/travel/${travelId}`)
  if (!res.ok) { setLoading(false); return }
  const data = await res.json()
  setTravel(data.travel ?? null)
  setJournals(data.journals ?? [])
  setSegments(data.segments ?? [])
  setLocationImage(data.location_image ?? null)
  setLoading(false)
}, [travelId])
```

In the render, if `segments.length > 1`, show a route summary header:

```typescript
{/* 旅行路线概览 */}
{segments.length > 1 && (
  <div className="p-3 bg-gradient-to-r from-river-50 to-meadow-50 rounded-xl">
    <p className="text-xs font-medium text-gray-600 mb-2">旅行路线</p>
    <div className="flex items-center gap-1 flex-wrap">
      {segments.map((seg, i) => {
        const segLoc = seg.travel_locations as { name: string } | null
        return (
          <div key={seg.id} className="flex items-center">
            {i > 0 && <span className="text-gray-300 mx-1">→</span>}
            <span className="text-[11px] px-2 py-0.5 bg-white rounded-full text-gray-700 shadow-sm">
              {segLoc?.name?.split('·').pop() ?? '?'}
              {seg.visit_count > 1 && <span className="text-amber-500 ml-0.5">×{seg.visit_count}</span>}
            </span>
          </div>
        )
      })}
    </div>
  </div>
)}
```

Group journals by location in the display — each journal already has `location_name`, so they will naturally show different locations.

- [ ] **Step 2: Commit**

```bash
git add src/app/travel/[id]/page.tsx
git commit -m "feat: travel detail page shows multi-location route + grouped journals"
```

---

### Task 13: Build Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Fix any TypeScript errors that arise.

- [ ] **Step 2: Manual test flow**

1. Start dev server: `npm run dev`
2. Navigate to travel page, start a trip
3. Watch for segment transitions during polling (in testing mode, 1 day = 1 minute)
4. Generate journals at each location
5. Verify the travel detail page shows the route
6. Start another trip to the same first location — verify shorter stay

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from multi-location travel implementation"
```
