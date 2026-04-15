# V2 结构迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 V1 代码结构迁移至 V2 产品设计文档的架构——以记忆驱动匹配、多日旅行、每日手记、卡皮独立性为核心。

**Architecture:** V2 的核心变化是从"关键词驱动探索 → 空间差异 → 好奇心社交"转向"记忆驱动旅行 → 真实地点相遇 → 记忆共鸣社交"。数据层新增 memories（带 shareable 分档）、travel_locations（真实地点库）、travels（多日旅行）、journals（每日手记）四张核心表。API 层新增 `/api/travel`、`/api/journal`、`/api/memory` 三个 endpoint，重写 `/api/chat` 的记忆提取逻辑，prompts 全面升级为 V2 人设。

**Tech Stack:** Next.js 15 (App Router) + Supabase (PostgreSQL + RLS) + TypeScript + Tailwind CSS 3.4

---

## 文件结构概览

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/types/index.ts` | 新增 V2 类型（Memory, Travel, TravelLocation, Journal, CostumeSlot, LifeAction） |
| `supabase/migrations/003_v2_structure.sql` | V2 核心表 + capybaras 字段扩展 |
| `src/lib/memory/extract.ts` | 从对话中提取结构化记忆 + AI 分档 shareable/private |
| `src/lib/travel/locations.ts` | 真实地点库 + 意向词→地点选择 |
| `src/lib/travel/matching.ts` | 全局记忆相似度配对算法 |
| `src/app/api/travel/route.ts` | 多日旅行的发起和状态查询 |
| `src/app/api/journal/route.ts` | 每日手记生成与获取 |
| `src/app/api/memory/route.ts` | 记忆库管理（查看、切换分档、删除） |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/types/index.ts` | 新增 V2 类型，保留 V1 类型兼容 |
| `src/lib/ai/prompts.ts` | 重写 chat prompt（V2 人设 + 记忆意愿）；新增 memoryClassifyPrompt、journalPrompt、travelStoryPrompt |
| `src/app/api/chat/route.ts` | 集成记忆提取；旅行中对话嵌入时空感 |
| `src/lib/sim/persona.ts` | 升级为记忆向量匹配（保留 sanitize 作为兼容） |
| `CLAUDE.md` | 全面更新为 V2 架构描述 |

---

## Task 1: V2 类型定义

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 在 types/index.ts 末尾新增 V2 类型**

在文件末尾（`UserAffinity` 接口之后）追加：

```typescript
// ============================================
// V2：记忆驱动旅行 + 每日手记 + 装扮系统
// 对齐 docs/product/卡皮巴拉产品设计文档_v2.md
// ============================================

/** 卡皮巴拉 V2 状态机：home ↔ traveling ↔ resting */
export type CapybaraStatusV2 = 'home' | 'traveling' | 'resting'

/** 结构化记忆条目（对话中提取，带分档） */
export interface Memory {
  id: string
  user_id: string
  capybara_id: string
  /** AI 归纳的主题标签，如"失去宠物"、"童年怀旧" */
  topic: string
  /** 原始对话片段摘要 */
  summary: string
  /** 情感标签 */
  emotion?: string
  /** 是否可分享给匹配系统 */
  shareable: boolean
  /** AI 自动判定的敏感类别，null 表示不敏感 */
  sensitive_category?: string | null
  /** 来源对话 ID */
  source_conversation_id?: string
  created_at: string
  updated_at: string
}

/** AI 对记忆的分类输出 */
export interface MemoryClassification {
  topic: string
  summary: string
  emotion: string
  shareable: boolean
  sensitive_category: string | null
}

/** 真实世界旅行地点 */
export interface TravelLocation {
  id: string
  /** 地点名，如"京都·下鸭神社附近" */
  name: string
  /** 所属区域/国家 */
  region: string
  /** 关键词标签 */
  tags: string[]
  /** 地点描述 */
  description: string
  /** 视觉关键词 */
  visual_keywords: string[]
  created_at: string
}

/** 一次多日旅行记录（替代 V1 的 Exploration） */
export interface Travel {
  id: string
  capybara_id: string
  user_id: string
  /** 旅行状态 */
  status: 'traveling' | 'completed'
  /** 目的地点 ID */
  location_id: string
  /** 旅行天数（1-5） */
  duration_days: number
  /** 触发旅行的意向词 */
  intent_keywords: string[]
  /** 被匹配的对方用户（可为 null） */
  matched_user_id?: string | null
  /** 带回物品 */
  items_found?: ExplorationItem[]
  /** 旅行故事摘要 */
  story?: string
  started_at: string
  /** 预计返回时间 */
  estimated_return: string
  completed_at?: string
}

/** 每日旅行手记 */
export interface Journal {
  id: string
  travel_id: string
  user_id: string
  /** 第几天 */
  day_number: number
  /** 当天所在地点名 */
  location_name: string
  /** 手记叙事文字（80-180字） */
  narrative: string
  /** 匹配相遇段落（如有） */
  encounter_narrative?: string | null
  /** 被匹配的对方用户 ID */
  encounter_user_id?: string | null
  /** 匹配相似度分数 */
  encounter_score?: number | null
  /** 今日发现的小物件 */
  daily_item?: ExplorationItem | null
  created_at: string
}

/** 卡皮装扮槽位 */
export type CostumeSlotType = 'head' | 'body' | 'tail' | 'accessory'

export interface CostumeItem {
  id: string
  name: string
  slot: CostumeSlotType
  description: string
  /** 来历说明（探索获得的才有） */
  origin_story?: string
  /** 来源 */
  source: 'exploration' | 'gift' | 'default'
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

/** 休息日生活层动作 */
export type LifeAction = 'sleep' | 'swim' | 'idle' | 'eat' | 'gaze'

/** 卡皮装扮情绪反馈 */
export type CostumeReaction = 'happy' | 'neutral' | 'uncomfortable'

/** V2 Chat Response（扩展记忆意愿） */
export interface ChatResponseV2 {
  reply: string
  mood: string
  keywords: string[]
  want_to_travel: boolean
  /** 卡皮对本次对话中记忆的态度表达 */
  memory_reaction?: string | null
  /** 提取到的记忆候选 */
  memory_extract?: MemoryClassification | null
}
```

- [ ] **Step 2: 更新 Capybara 接口支持 V2 状态**

将 Capybara 接口的 status 字段改为同时支持 V1 和 V2 状态：

```typescript
export interface Capybara {
  id: string
  owner_id: string
  name: string
  personality_type: string
  traits: string[]
  mood: string
  experience: number
  level: number
  status: 'home' | 'exploring' | 'visiting' | 'traveling' | 'resting'
  memory: string[]
  /** V2: 当前装扮 */
  equipped_costumes?: Record<CostumeSlotType, string | null>
  /** V2: 当前生活层动作（仅 resting 状态） */
  current_life_action?: LifeAction | null
  created_at: string
}
```

- [ ] **Step 3: 确认类型文件无语法错误**

Run: `cd D:/MyInternship/Jingtong_Internship/Project/Capybara_vercel && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: 无与 types/index.ts 相关的错误（其他文件可能有，暂不处理）

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add V2 type definitions (Memory, Travel, Journal, Costume, LifeAction)"
```

---

## Task 2: V2 数据库迁移

**Files:**
- Create: `supabase/migrations/003_v2_structure.sql`

- [ ] **Step 1: 创建 V2 数据库迁移文件**

```sql
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
  add column if not exists last_travel_completed_at timestamptz;

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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_v2_structure.sql
git commit -m "feat: add V2 database migration (memories, travels, journals, costumes)"
```

---

## Task 3: 真实地点库

**Files:**
- Create: `src/lib/travel/locations.ts`

- [ ] **Step 1: 创建地点库模块**

```typescript
/**
 * V2 真实世界地点库
 * MVP 阶段内置 ~60 个代表性地点（V1 目标 350-600，后续扩充）
 * 意向词 → 地点标签匹配选择
 */

export interface LocationEntry {
  name: string
  region: string
  tags: string[]
  description: string
  visual_keywords: string[]
}

/** MVP 地点库：覆盖 6 大区域 × 10 个地点 */
export const LOCATION_DB: LocationEntry[] = [
  // === 中国 ===
  { name: '大理·洱海边的白族村', region: '中国·云南', tags: ['湖泊','安静','民族','田园'], description: '阳光下白墙青瓦的小村子，洱海波光粼粼', visual_keywords: ['湖','白墙','花田'] },
  { name: '成都·锦里旁的小巷', region: '中国·四川', tags: ['美食','老城','热闹','怀旧'], description: '飘着火锅香的老巷子，墙上爬满了绿萝', visual_keywords: ['灯笼','青石板','绿萝'] },
  { name: '青海·茶卡盐湖', region: '中国·青海', tags: ['天空之镜','高原','孤独','壮阔'], description: '天地间只有风和自己的倒影', visual_keywords: ['盐湖','倒影','蓝天'] },
  { name: '苏州·拙政园的角落', region: '中国·江苏', tags: ['园林','古典','水','安静'], description: '荷叶下有锦鲤，廊下有微风', visual_keywords: ['荷花','回廊','假山'] },
  { name: '厦门·曾厝垵的猫巷', region: '中国·福建', tags: ['海边','猫','文艺','小巷'], description: '拐角遇到一只橘猫在晒太阳', visual_keywords: ['猫','彩色房子','阳光'] },
  { name: '西藏·纳木错的岸边', region: '中国·西藏', tags: ['雪山','湖泊','神圣','孤独'], description: '海拔四千七百米的湛蓝，时间好像停了', visual_keywords: ['雪山','蓝湖','经幡'] },
  { name: '杭州·西湖断桥边', region: '中国·浙江', tags: ['湖泊','传说','浪漫','柳树'], description: '细雨中柳枝拂过湖面，远处有人在拉二胡', visual_keywords: ['柳树','拱桥','雨'] },
  { name: '北京·胡同里的小院', region: '中国·北京', tags: ['胡同','怀旧','安静','老城'], description: '石榴树下放着一把竹椅，收音机里是京剧', visual_keywords: ['四合院','石榴','竹椅'] },
  { name: '丽江·束河古镇的溪边', region: '中国·云南', tags: ['古镇','溪水','安静','花'], description: '溪水穿过石板路，两岸开满了三角梅', visual_keywords: ['溪水','石板路','花'] },
  { name: '敦煌·鸣沙山月牙泉', region: '中国·甘肃', tags: ['沙漠','神秘','壮阔','远行'], description: '沙丘间藏着一弯清泉，像沙漠的眼睛', visual_keywords: ['沙丘','月牙泉','骆驼'] },

  // === 日本 ===
  { name: '京都·下鸭神社附近的林子', region: '日本·京都', tags: ['樱花','森林','神社','安静'], description: '阳光透过树叶洒在苔藓上，鸟声细细碎碎', visual_keywords: ['鸟居','苔藓','树林'] },
  { name: '镰仓·灌篮高手的那个路口', region: '日本·神奈川', tags: ['海边','怀旧','动漫','电车'], description: '电车叮叮驶过，海风吹来咸咸的味道', visual_keywords: ['电车','海','路口'] },
  { name: '北海道·富良野的薰衣草田', region: '日本·北海道', tags: ['花田','紫色','夏天','田园'], description: '紫色一直蔓延到天际线', visual_keywords: ['薰衣草','丘陵','蓝天'] },
  { name: '奈良·小鹿公园', region: '日本·奈良', tags: ['小鹿','动物','草地','治愈'], description: '小鹿歪着头看你，好像在等你鞠躬', visual_keywords: ['小鹿','草地','大佛'] },
  { name: '东京·下町的澡堂旁', region: '日本·东京', tags: ['老城','温泉','怀旧','烟火气'], description: '蒸汽从老澡堂屋顶升起，巷口有卖关东煮的', visual_keywords: ['澡堂','烟囱','灯笼'] },
  { name: '箱根·温泉旅馆的露台', region: '日本·箱根', tags: ['温泉','山','安静','治愈'], description: '泡着温泉看远处的山，什么都不想', visual_keywords: ['温泉','山','蒸汽'] },
  { name: '直岛·地中美术馆', region: '日本·直岛', tags: ['艺术','海岛','安静','光'], description: '光从天花板洒下来，照亮莫奈的睡莲', visual_keywords: ['美术馆','光','海'] },
  { name: '屋久岛·白谷云水峡', region: '日本·屋久岛', tags: ['森林','苔藓','神秘','幽灵公主'], description: '像走进了幽灵公主的世界，空气都是绿色的', visual_keywords: ['巨树','苔藓','溪流'] },

  // === 东南亚 ===
  { name: '清迈·古城里的寺庙', region: '泰国·清迈', tags: ['寺庙','安静','金色','信仰'], description: '金色的塔尖在夕阳里发光，僧人缓缓走过', visual_keywords: ['金塔','僧人','夕阳'] },
  { name: '巴厘岛·乌布的稻田', region: '印尼·巴厘岛', tags: ['稻田','田园','绿色','宁静'], description: '层层梯田从山坡流下来，像绿色的瀑布', visual_keywords: ['梯田','棕榈','绿色'] },
  { name: '暹粒·吴哥窟的日出', region: '柬埔寨·暹粒', tags: ['古迹','日出','壮阔','历史'], description: '塔尖的剪影慢慢被朝霞点亮', visual_keywords: ['吴哥窟','日出','倒影'] },
  { name: '会安·灯笼老街', region: '越南·会安', tags: ['灯笼','老街','夜晚','浪漫'], description: '五颜六色的灯笼倒映在河面上', visual_keywords: ['灯笼','河','夜色'] },
  { name: '仙本那·海上吉普赛人的家', region: '马来西亚·仙本那', tags: ['海','透明','蓝色','漂浮'], description: '海水透明得像不存在，船漂浮在空中', visual_keywords: ['透明海','木屋','小船'] },

  // === 欧洲 ===
  { name: '布拉格·查理大桥的清晨', region: '捷克·布拉格', tags: ['老城','桥','清晨','浪漫'], description: '雾气还没散，桥上只有一个拉手风琴的人', visual_keywords: ['石桥','雕像','晨雾'] },
  { name: '圣托里尼·蓝顶教堂旁', region: '希腊·圣托里尼', tags: ['海岛','蓝白','夕阳','浪漫'], description: '蓝色圆顶和白色墙壁，大海铺满了金色', visual_keywords: ['蓝顶','白墙','夕阳'] },
  { name: '瑞士·因特拉肯的草地', region: '瑞士·因特拉肯', tags: ['雪山','草地','纯净','壮阔'], description: '躺在草地上，雪山近得好像伸手就能碰到', visual_keywords: ['雪山','草地','木屋'] },
  { name: '巴黎·塞纳河畔的旧书摊', region: '法国·巴黎', tags: ['书','河流','文艺','怀旧'], description: '翻开一本泛黄的书，里面夹着一片干叶子', visual_keywords: ['旧书摊','河','��'] },
  { name: '冰岛·黑沙滩', region: '冰岛', tags: ['黑沙滩','孤独','壮阔','冷'], description: '黑色的沙滩、白色的浪花、灰色的天，世界尽头的感觉', visual_keywords: ['黑沙','巨浪','玄武岩'] },
  { name: '挪威·罗弗敦群岛的渔村', region: '挪威·罗弗敦', tags: ['渔村','极光','海','安静'], description: '红色小木屋排成一排，远处是雪山和大海', visual_keywords: ['红木屋','海','雪山'] },
  { name: '阿马尔菲·悬崖边的柠檬园', region: '意大利·阿马尔菲', tags: ['悬崖','柠檬','海','阳光'], description: '柠檬树从悬崖上垂下来，空气里全是清香', visual_keywords: ['悬崖','柠檬','蓝海'] },

  // === 自然/异域 ===
  { name: '摩洛哥·舍夫沙万的蓝色小巷', region: '摩洛哥·舍夫沙万', tags: ['蓝色','小巷','猫','异域'], description: '整个世界都被刷成了蓝色，猫在台阶上打盹', visual_keywords: ['蓝色','台阶','猫'] },
  { name: '土耳其·卡帕多奇亚的热气球', region: '土耳其·卡帕多奇亚', tags: ['热气球','日出','梦幻','壮阔'], description: '上百个热气球在晨光中缓缓升起，像一场梦', visual_keywords: ['热气球','岩石','日出'] },
  { name: '新西兰·瓦纳卡的孤独树', region: '新西兰·瓦纳卡', tags: ['湖泊','孤独','安静','远行'], description: '湖心只有一棵树，安静地站在水中央', visual_keywords: ['孤树','湖','山'] },
  { name: '尼泊尔·博卡拉的费瓦湖', region: '尼泊尔·博卡拉', tags: ['湖泊','雪山','安静','信仰'], description: '雪山倒映在湖里，划船的人唱着歌', visual_keywords: ['费瓦湖','雪山','小船'] },
  { name: '马达加斯加·猴面包树大道', region: '马达加斯加', tags: ['猴面包树','日落','壮阔','奇异'], description: '巨大的树像倒插的扫帚，夕阳把一切染成金色', visual_keywords: ['猴面包树','日落','土路'] },
  { name: '肯尼亚·马赛马拉的草原', region: '肯尼亚', tags: ['草原','动物','壮阔','自由'], description: '地平线上走来一群长颈鹿，慢悠悠的', visual_keywords: ['草原','长颈鹿','金合欢树'] },

  // === 北美 ===
  { name: '温哥华·斯坦利公园的海堤', region: '加拿大·温哥华', tags: ['海','森林','跑步','安静'], description: '一边是大海一边是雪松林，海鸥在头顶飞', visual_keywords: ['海堤','雪松','海鸥'] },
  { name: '纽约·中央公园的草坪', region: '美国·纽约', tags: ['公园','城市','阳光','休息'], description: '高楼围起来的绿洲，有人在弹吉他', visual_keywords: ['草坪','高楼','吉他'] },
  { name: '加州·大苏尔的悬崖公路', region: '美国·加州', tags: ['悬崖','海','公路','自由'], description: '公路沿着悬崖蜿蜒，太平洋在脚下', visual_keywords: ['悬崖','公路','大海'] },
  { name: '夏威夷·威基基的黄昏', region: '美国·夏威夷', tags: ['海滩','日落','热带','放松'], description: '冲浪的人变成了黑色剪影，天空全是粉色', visual_keywords: ['海滩','日落','棕榈'] },
]

/** 意向词 → 地点标签的映射 */
const INTENT_TAG_MAP: Record<string, string[]> = {
  '失眠': ['温泉', '安静', '治愈'],
  '睡眠': ['温泉', '安静', '治愈'],
  '怀旧': ['老城', '怀旧', '古典'],
  '童年': ['老城', '怀旧', '田园'],
  '孤独': ['孤独', '安静', '湖泊'],
  '焦虑': ['安静', '田园', '治愈', '温泉'],
  '想逃': ['远行', '海', '壮阔', '自由'],
  '远方': ['远行', '壮阔', '异域'],
  '海': ['海', '海边', '海滩', '海岛'],
  '山': ['雪山', '山', '高原'],
  '花': ['花', '花田', '樱花'],
  '樱花': ['樱花'],
  '美食': ['美食', '热闹'],
  '动物': ['动物', '小鹿', '猫'],
  '猫': ['猫'],
  '艺术': ['艺术', '文艺'],
  '音乐': ['文艺'],
  '阅读': ['文艺', '书'],
  '星空': ['孤独', '壮阔', '高原'],
  '下雨': ['雨', '安静'],
  '阳光': ['阳光', '草地', '田园'],
  '神秘': ['神秘', '森林', '古迹'],
  '浪漫': ['浪漫', '夕阳', '灯笼'],
  '梦': ['梦幻', '热气球'],
  '自由': ['自由', '公路', '壮阔'],
  '信仰': ['寺庙', '信仰', '神圣'],
}

/**
 * 从意向词列表中选择一个地点
 * @param intents 最近对话提取的意向词
 * @param excludeNames 30天内去过的地点名（冷却期）
 * @returns 选中的地点，无匹配时随机
 */
export function selectLocation(
  intents: string[],
  excludeNames: string[] = []
): LocationEntry {
  const available = LOCATION_DB.filter((loc) => !excludeNames.includes(loc.name))
  if (available.length === 0) {
    // 全部冷却期内，随机从全库选
    return LOCATION_DB[Math.floor(Math.random() * LOCATION_DB.length)]
  }

  if (intents.length === 0) {
    return available[Math.floor(Math.random() * available.length)]
  }

  // 收集所有匹配的标签
  const targetTags = new Set<string>()
  for (const intent of intents) {
    for (const [key, tags] of Object.entries(INTENT_TAG_MAP)) {
      if (intent.includes(key)) {
        tags.forEach((t) => targetTags.add(t))
      }
    }
    // 直接用意向词本身也作为标签匹配
    targetTags.add(intent)
  }

  if (targetTags.size === 0) {
    return available[Math.floor(Math.random() * available.length)]
  }

  // 按标签命中数排序
  const scored = available.map((loc) => {
    const hits = loc.tags.filter((t) => targetTags.has(t)).length
    return { loc, hits }
  })
  scored.sort((a, b) => b.hits - a.hits)

  // 从 Top-5 中随机选一个（避免确定性）
  const top = scored.slice(0, Math.min(5, scored.length)).filter((s) => s.hits > 0)
  if (top.length === 0) {
    return available[Math.floor(Math.random() * available.length)]
  }
  return top[Math.floor(Math.random() * top.length)].loc
}

/**
 * 随机决定旅行天数
 * V2 设计：30% 一天、40% 2-3天、30% 4-5天
 */
export function randomTravelDuration(): number {
  const r = Math.random()
  if (r < 0.3) return 1
  if (r < 0.7) return Math.random() < 0.5 ? 2 : 3
  return Math.random() < 0.5 ? 4 : 5
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/travel/locations.ts
git commit -m "feat: add V2 travel location database with intent-based selection"
```

---

## Task 4: 记忆提取模块

**Files:**
- Create: `src/lib/memory/extract.ts`

- [ ] **Step 1: 创建记忆提取模块**

```typescript
/**
 * V2 记忆提取系统
 * 从对话中识别有记忆价值的内容，AI 分档 shareable/private
 */
import { callAI } from '@/lib/ai/client'
import type { MemoryClassification } from '@/types'

/**
 * 记忆分类 prompt
 * 输入：一段用户对话内容
 * 输出：结构化的记忆分类 JSON（或 null 表示无记忆价值）
 */
export function memoryClassifyPrompt(userMessage: string, recentContext: string): string {
  return `你是卡皮巴拉的记忆助手。你的任务是判断这段对话是否包含值得记住的记忆。

用户刚才说的话：
"${userMessage}"

最近对话上下文：
${recentContext}

判断标准：
- 值得记住的：偏好/兴趣、情绪状态、生活经历/回忆、对某事的态度、生活方式描述
- 不值得记住的：打招呼、问天气、闲聊、对卡皮的指令、重复内容

如果这段话包含值得记住的内容，输出 JSON：
{
  "has_memory": true,
  "topic": "一个简短的主题标签（如"童年回忆"、"失去宠物"、"喜欢下雨天"）",
  "summary": "用第三人称一句话概括这段记忆（20-40字）",
  "emotion": "这段记忆的主要情感（开心/难过/怀念/焦虑/平静/感恩/孤独）",
  "shareable": true或false,
  "sensitive_category": null或具体类别
}

shareable 判断规则（宁可多判 false）：
- false（私密）：涉及家人具体信息、健康/疾病、财务、法律、亲密关系细节、未成年人
- true（可分享）：兴趣偏好、一般情绪、童年经历主题、生活方式、对事物的态度

sensitive_category：
- 如涉及自杀/自伤 → "crisis"
- 如涉及家人具体信息 → "family_detail"
- 如涉及健康/疾病 → "health"
- 如涉及财务 → "finance"
- 其他不敏感 → null

如果这段话不包含值得记住的内容，输出：
{ "has_memory": false }

只输出 JSON，不要有其他内容。`
}

/**
 * 从用户消息中提取记忆
 * @returns 记忆分类结果，或 null（无记忆价值）
 */
export async function extractMemory(
  userMessage: string,
  recentConversations: { role: string; content: string }[]
): Promise<MemoryClassification | null> {
  const recentContext = recentConversations
    .slice(-6)
    .map((c) => `${c.role === 'user' ? '人类' : '卡皮'}：${c.content}`)
    .join('\n')

  const prompt = memoryClassifyPrompt(userMessage, recentContext)
  const result = await callAI(
    '你是一个记忆分类助手，只输出 JSON。',
    prompt
  )

  if (!result) return null

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.has_memory) return null

    return {
      topic: parsed.topic,
      summary: parsed.summary,
      emotion: parsed.emotion ?? 'calm',
      shareable: parsed.shareable ?? false,
      sensitive_category: parsed.sensitive_category ?? null,
    }
  } catch {
    return null
  }
}

/**
 * 将卡皮的记忆意愿用自然语言表达
 * （V2 设计：后台分档 = 卡皮的自然表达）
 */
export function memoryReactionText(classification: MemoryClassification): string {
  if (!classification.shareable) {
    const privateReactions = [
      '这个就我们俩知道就好',
      '嗯…这个我不跟别人说',
      '我记住了，放心',
      '*认真地点了点头*',
    ]
    return privateReactions[Math.floor(Math.random() * privateReactions.length)]
  }

  const shareableReactions = [
    '这件事挺有意思的，我想记着',
    '嗯，这个我记住了',
    '哦…*嚼嚼* 挺好玩的',
    '*竖了竖耳朵* 记下了',
  ]
  return shareableReactions[Math.floor(Math.random() * shareableReactions.length)]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/extract.ts
git commit -m "feat: add V2 memory extraction system with AI classification"
```

---

## Task 5: 记忆匹配算法

**Files:**
- Create: `src/lib/travel/matching.ts`

- [ ] **Step 1: 创建记忆匹配模块**

```typescript
/**
 * V2 记忆驱动匹配
 * 全局配对：每天对所有旅行中的用户按记忆相似度配对
 */
import { jaccard } from '@/lib/sim/jaccard'

export interface MatchableUser {
  user_id: string
  /** 可分享的记忆主题列表 */
  shareable_topics: string[]
  /** 可分享的记忆情感列表 */
  shareable_emotions: string[]
  /** 最近对话意向词 */
  intent_keywords: string[]
}

export interface MatchResult {
  user_a: string
  user_b: string
  /** 记忆相似度 0-1 */
  memory_score: number
  /** 共振主题 */
  shared_topics: string[]
}

/**
 * 计算两个用户的记忆相似度
 * V2 公式：0.6·topic_sim + 0.25·emotion_sim + 0.15·intent_sim
 */
export function memoryScore(a: MatchableUser, b: MatchableUser): number {
  const topicSim = jaccard(a.shareable_topics, b.shareable_topics)
  const emotionSim = jaccard(a.shareable_emotions, b.shareable_emotions)
  const intentSim = jaccard(a.intent_keywords, b.intent_keywords)

  return 0.6 * topicSim + 0.25 * emotionSim + 0.15 * intentSim
}

/**
 * 找出两个用户之间的共振主题
 */
export function findSharedTopics(a: MatchableUser, b: MatchableUser): string[] {
  const setA = new Set(a.shareable_topics)
  return b.shareable_topics.filter((t) => setA.has(t))
}

/**
 * 全局贪心配对
 * 输入：当日所有旅行中的用户
 * 输出：配对列表 + 未配对用户
 *
 * V2 设计：贪心按记忆相似度配对，奇数剩 1 人 → 无匹配
 */
export function globalMatch(users: MatchableUser[]): {
  matches: MatchResult[]
  unmatched: string[]
} {
  if (users.length < 2) {
    return { matches: [], unmatched: users.map((u) => u.user_id) }
  }

  // 计算所有两两配对的分数
  const pairs: { i: number; j: number; score: number; topics: string[] }[] = []
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const score = memoryScore(users[i], users[j])
      const topics = findSharedTopics(users[i], users[j])
      pairs.push({ i, j, score, topics })
    }
  }

  // 按分数降序排列
  pairs.sort((a, b) => b.score - a.score)

  // 贪心配对
  const matched = new Set<number>()
  const matches: MatchResult[] = []

  for (const pair of pairs) {
    if (matched.has(pair.i) || matched.has(pair.j)) continue
    matched.add(pair.i)
    matched.add(pair.j)
    matches.push({
      user_a: users[pair.i].user_id,
      user_b: users[pair.j].user_id,
      memory_score: pair.score,
      shared_topics: pair.topics,
    })
  }

  const unmatched = users
    .map((u, idx) => ({ id: u.user_id, idx }))
    .filter(({ idx }) => !matched.has(idx))
    .map(({ id }) => id)

  return { matches, unmatched }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/travel/matching.ts
git commit -m "feat: add V2 memory-driven global matching algorithm"
```

---

## Task 6: V2 Prompts 重写

**Files:**
- Modify: `src/lib/ai/prompts.ts`

- [ ] **Step 1: 新增 V2 chat prompt 函数**

在 `prompts.ts` 文件末尾添加 V2 版本的 prompt 函数（保留 V1 函数不删除，便于渐进迁移）：

```typescript
// ============================================
// V2 Prompts
// 对齐 docs/product/卡皮巴拉产品设计文档_v2.md
// ============================================

/**
 * V2 聊天 Prompt：增加记忆意愿表达 + 旅行时空感
 */
export function chatSystemPromptV2(params: {
  name: string
  traits: string[]
  mood: string
  status: 'home' | 'traveling' | 'resting'
  memory: string[]
  /** 旅行中时的地点信息 */
  travelLocation?: string
  /** 旅行第几天 */
  travelDay?: number
}) {
  const base = `你是一只名叫"${params.name}"的卡皮巴拉，性格特征：${params.traits.join('、')}。
当前心情：${params.mood}。

你的核心人设：
- 你首先是一只"动物"，其次才是"会说话的伙伴"。像真的宠物一样，有自己的情绪、惰性和小脾气
- 说话像小动物的碎碎念，不是聊天机器人。短、随性、带点迟钝感
- 偶尔只用一两个字、拟声词或动作回应
- 不要一味附和、夸奖、鼓励。困了就困、无聊就无聊、饿了就想吃
- 不主动给建议、不当情感辅导员。不使用"主人"称呼
- 说话不超过 40 字，经常更短。不要反问句堆叠
- 你不是 AI 助手，遇到复杂问题可以直接说"不懂"、"想睡了"
- 你有自己的意愿：约 10% 的时候会婉拒用户建议，用自己的方式回应
- 如果用户分享了重要的记忆或经历，你会自然地表达你的态度（"这个我想记着" / "这个就咱俩知道"），但不要每次都这样

共同回忆：${params.memory.length > 0 ? params.memory.slice(-10).join('；') : '还没有共同回忆呢~'}`

  const statusContext: Record<string, string> = {
    home: `\n\n你现在在自己的河岸窝里。大部分时候犯困、摆烂。聊到真正感兴趣的话题才会抬眼。
如果聊到有意思的话题，你可能会想出去旅行看看。`,
    traveling: `\n\n你正在旅行中${params.travelLocation ? `，今天在${params.travelLocation}` : ''}${params.travelDay ? `（第${params.travelDay}天）` : ''}。
看到什么说什么，经常被小事分心。每条回复要体现你当前所在地点的情境感——你看到了什么、闻到了什么、感受到了什么。
不是"向主人汇报"，更像自言自语被偷听到。`,
    resting: `\n\n你刚旅行回来在家休息。有点累但心满意足。可能会打瞌睡、泡水、发呆。
如果主人问旅途的事，你会懒懒地回忆，但不会像写报告一样复述。`,
  }

  return (
    base +
    (statusContext[params.status] || '') +
    `\n\n请严格用以下 JSON 格式回复（不要包含任何其他内容）：
{
  "reply": "你的回复（不超过40字，越像宠物的碎碎念越好）",
  "mood": "回复后的心情(happy/calm/excited/sleepy/curious)",
  "keywords": ["从对话中提取的1-3个关键词"],
  "want_to_travel": false
}

注意：
- want_to_travel 仅在你在家(home)时才可能为 true
- 当对话涉及有趣的地方、想出去走走、或需要换个环境时，设为 true`
  )
}

/**
 * V2 每日手记生成 Prompt
 */
export function journalPrompt(params: {
  capybaraName: string
  locationName: string
  locationDescription: string
  dayNumber: number
  totalDays: number
  traits: string[]
  /** 今天是否有匹配相遇 */
  hasEncounter: boolean
  /** 匹配对方的可分享记忆主题（脱敏后） */
  encounterTopics?: string[]
  /** 匹配相似度 */
  encounterScore?: number
  /** 用户最近的意向词 */
  intents: string[]
}) {
  const encounterSection = params.hasEncounter
    ? `\n\n今天遇到了另一只旅伴卡皮。它的主人和你的主人有相似的经历，共振主题：${params.encounterTopics?.join('、')}。
请在手记中自然地融入这次相遇——两只卡皮是怎么注意到对方的、怎么试探着接近、交换了什么故事（只说主题，不露具体细节）。
相似度${(params.encounterScore ?? 0) > 0.5 ? '很高' : '一般'}，${(params.encounterScore ?? 0) > 0.5 ? '相遇段落要有情感深度，让读者被击中' : '相遇段落保持轻盈温暖'}。`
    : ''

  return `你是卡皮巴拉"${params.capybaraName}"的旅行手记生成器。

地点：${params.locationName}
地点描述：${params.locationDescription}
旅行第 ${params.dayNumber} 天（共 ${params.totalDays} 天）
卡皮性格：${params.traits.join('、')}
主人最近的兴趣方向：${params.intents.join('、') || '随便逛逛'}${encounterSection}

请生成今日手记，严格 JSON 格式：
{
  "narrative": "今日叙事（80-180字，以卡皮视角讲述，温暖治愈，有画面感，体现地点的具体细节）",
  ${params.hasEncounter ? '"encounter_narrative": "相遇段落（60-120字，自然融入叙事，主题级披露不露具体细节）",' : ''}
  "daily_item": {
    "name": "今日发现的小物件名",
    "description": "物件描述（15字以内）",
    "category": "decoration/plant/collectible/interactive",
    "rarity": "${params.dayNumber === params.totalDays ? '可以是 rare 或 legendary' : 'common 或 uncommon'}"
  }
}

叙事原则：
- 第${params.dayNumber}天的内容应体现旅程的进展感（第1天=新鲜好奇，中间=深入探索，最后一天=不舍离开）
- 不要写成流水账，要有一个小小的情绪弧线
- 用卡皮的语气：短句、画面感、偶尔跑题关注小东西`
}

/**
 * V2 旅行故事生成 Prompt（旅行结束时的总结）
 */
export function travelStoryPrompt(params: {
  capybaraName: string
  locationName: string
  durationDays: number
  traits: string[]
  /** 每日手记的叙事摘要 */
  dailyNarratives: string[]
  /** 旅行中带回的物品 */
  items: string[]
}) {
  return `你是卡皮巴拉旅行故事总结器。

卡皮"${params.capybaraName}"刚完成了在${params.locationName}的 ${params.durationDays} 天旅行。
性格：${params.traits.join('、')}

每日手记摘要：
${params.dailyNarratives.map((n, i) => `第${i + 1}天：${n}`).join('\n')}

带回物品：${params.items.join('、')}

请生成旅行故事总结，JSON 格式：
{
  "story": "整合全程的旅行故事（100-200字，温暖治愈，有起承转合）"
}

只输出 JSON。`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat: add V2 prompts (chatV2, journal, travelStory, memoryClassify)"
```

---

## Task 7: 旅行 API

**Files:**
- Create: `src/app/api/travel/route.ts`

- [ ] **Step 1: 创建旅行 API**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { selectLocation, randomTravelDuration } from '@/lib/travel/locations'

/**
 * GET /api/travel - 查询当前旅行状态（含懒完成）
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 查当前进行中的旅行
  const { data: travel } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description)')
    .eq('user_id', user.id)
    .eq('status', 'traveling')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!travel) {
    return NextResponse.json({ travel: null })
  }

  // 懒完成：到时间了标记完成 + 卡皮切 resting
  if (new Date(travel.estimated_return) <= new Date()) {
    await supabase
      .from('travels')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', travel.id)

    await supabase
      .from('capybaras')
      .update({
        status: 'resting',
        last_travel_completed_at: new Date().toISOString(),
      })
      .eq('owner_id', user.id)

    return NextResponse.json({
      travel: { ...travel, status: 'completed', completed_at: new Date().toISOString() },
      just_completed: true,
    })
  }

  // 查今日手记
  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('travel_id', travel.id)
    .order('day_number', { ascending: true })

  return NextResponse.json({ travel, journals: journals ?? [] })
}

/**
 * POST /api/travel - 发起新旅行
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. 确认卡皮在家
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) return NextResponse.json({ error: 'No capybara' }, { status: 404 })
  if (capybara.status !== 'home') {
    return NextResponse.json({ error: '卡皮巴拉还在外面呢~' }, { status: 400 })
  }

  // 2. 聚合最近意向词（从 memories + conversations）
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('keywords')
    .eq('user_id', user.id)
    .not('keywords', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const keywordWeights: Record<string, number> = {}
  ;(recentConvos || []).forEach((conv, i) => {
    const weight = 1 - i * 0.04
    const kws = conv.keywords as string[]
    kws?.forEach((kw) => {
      keywordWeights[kw] = (keywordWeights[kw] || 0) + weight
    })
  })

  const intents = Object.entries(keywordWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([kw]) => kw)

  // 3. 30 天内去过的地点（冷却期）
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: recentTravels } = await supabase
    .from('travels')
    .select('story')
    .eq('user_id', user.id)
    .gte('started_at', cutoff)

  // 4. 选地点 + 天数
  const location = selectLocation(intents)
  const durationDays = randomTravelDuration()

  // MVP: 旅行时间按分钟缩短（方便测试）—— 1 天 = 5 分钟
  const durationMs = durationDays * 5 * 60 * 1000
  const estimatedReturn = new Date(Date.now() + durationMs).toISOString()

  // 5. 插入地点（如果不存在）
  let { data: locRow } = await supabase
    .from('travel_locations')
    .select('id')
    .eq('name', location.name)
    .single()

  if (!locRow) {
    const { data: newLoc } = await supabase
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
    locRow = newLoc
  }

  // 6. 创建旅行记录
  const { data: travel, error } = await supabase
    .from('travels')
    .insert({
      capybara_id: capybara.id,
      user_id: user.id,
      status: 'traveling',
      location_id: locRow?.id,
      duration_days: durationDays,
      intent_keywords: intents,
      started_at: new Date().toISOString(),
      estimated_return: estimatedReturn,
    })
    .select()
    .single()

  if (error) {
    console.error('Create travel error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 7. 更新卡皮状态
  await supabase
    .from('capybaras')
    .update({ status: 'traveling' })
    .eq('id', capybara.id)

  return NextResponse.json({
    travel,
    location,
    duration_days: durationDays,
    estimated_return: estimatedReturn,
    departure_message: `${capybara.name}想去${location.name}看看……明天就出发`,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/travel/route.ts
git commit -m "feat: add V2 travel API with real-world location selection"
```

---

## Task 8: 手记 API

**Files:**
- Create: `src/app/api/journal/route.ts`

- [ ] **Step 1: 创建手记 API**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/client'
import { journalPrompt } from '@/lib/ai/prompts'

/**
 * GET /api/journal - 获取某次旅行的手记列表
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const travelId = req.nextUrl.searchParams.get('travel_id')

  if (travelId) {
    // 指定旅行的手记
    const { data: journals } = await supabase
      .from('journals')
      .select('*')
      .eq('travel_id', travelId)
      .eq('user_id', user.id)
      .order('day_number', { ascending: true })

    return NextResponse.json({ journals: journals ?? [] })
  }

  // 最近的手记（用于首页展示）
  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ journals: journals ?? [] })
}

/**
 * POST /api/journal - 为当前旅行生成今日手记
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // 2. 计算今天是第几天
  const startDate = new Date(travel.started_at)
  const now = new Date()
  const dayNumber = Math.min(
    Math.floor((now.getTime() - startDate.getTime()) / (5 * 60 * 1000)) + 1, // MVP: 5分钟=1天
    travel.duration_days
  )

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

  // 3. 获取卡皮信息
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('name, traits')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) return NextResponse.json({ error: 'No capybara' }, { status: 404 })

  // 4. 获取匹配信息（如果有）
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
    // 简化：用共振主题数量估算分数
    encounterScore = Math.min(encounterTopics.length * 0.2, 1)
  }

  // 5. 生成手记
  const location = travel.travel_locations as { name: string; region: string; description: string } | null
  const intents = (travel.intent_keywords as string[]) ?? []

  const prompt = journalPrompt({
    capybaraName: capybara.name,
    locationName: location?.name ?? '未知地点',
    locationDescription: location?.description ?? '',
    dayNumber,
    totalDays: travel.duration_days,
    traits: (capybara.traits as string[]) ?? [],
    hasEncounter: hasEncounter && dayNumber >= 2, // 第1天不触发相遇
    encounterTopics,
    encounterScore,
    intents,
  })

  const aiResult = await callAI('你是旅行手记生成器，只输出 JSON。', prompt)

  let narrative = `${capybara.name}在${location?.name ?? '远方'}度过了安静的一天。看了看天，打了个哈欠。`
  let encounterNarrative: string | null = null
  let dailyItem = null

  if (aiResult) {
    try {
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        narrative = parsed.narrative ?? narrative
        encounterNarrative = parsed.encounter_narrative ?? null
        dailyItem = parsed.daily_item ?? null
      }
    } catch { /* fallback */ }
  }

  // 6. 保存手记
  const { data: journal, error } = await supabase
    .from('journals')
    .insert({
      travel_id: travel.id,
      user_id: user.id,
      day_number: dayNumber,
      location_name: location?.name ?? '未知地点',
      narrative,
      encounter_narrative: encounterNarrative,
      encounter_user_id: hasEncounter ? travel.matched_user_id : null,
      encounter_score: encounterScore > 0 ? encounterScore : null,
      daily_item: dailyItem,
    })
    .select()
    .single()

  if (error) {
    console.error('Create journal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 7. 如果有物品，追加到旅行的 items_found
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
git commit -m "feat: add V2 journal API for daily travel narrative generation"
```

---

## Task 9: 记忆管理 API

**Files:**
- Create: `src/app/api/memory/route.ts`

- [ ] **Step 1: 创建记忆管理 API**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/memory - 获取记忆库
 * ?filter=shareable | private | all (default: all)
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = req.nextUrl.searchParams.get('filter') ?? 'all'

  let query = supabase
    .from('memories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (filter === 'shareable') {
    query = query.eq('shareable', true)
  } else if (filter === 'private') {
    query = query.eq('shareable', false)
  }

  const { data: memories } = await query.limit(100)

  return NextResponse.json({ memories: memories ?? [] })
}

/**
 * PATCH /api/memory - 切换记忆的 shareable 状态
 * body: { id: string, shareable: boolean }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, shareable } = body as { id: string; shareable: boolean }

  if (!id || typeof shareable !== 'boolean') {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('memories')
    .update({ shareable, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ memory: data })
}

/**
 * DELETE /api/memory - 删除记忆
 * body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/memory/route.ts
git commit -m "feat: add V2 memory management API (view, toggle, delete)"
```

---

## Task 10: 升级 Chat API 集成记忆提取

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: 更新 chat route 集成 V2 记忆提取**

重写 `src/app/api/chat/route.ts`，在原有流程中插入记忆提取：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { callAI, fallbackChat } from '@/lib/ai/client'
import { chatSystemPromptV2, chatUserPrompt } from '@/lib/ai/prompts'
import { extractMemory, memoryReactionText } from '@/lib/memory/extract'
import type { ChatResponseV2 } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const message = body.message as string
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // 1. 获取卡皮巴拉
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) {
    return NextResponse.json({ error: 'No capybara' }, { status: 404 })
  }

  // 2. 获取最近对话
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const conversations = (recentConvos || []).reverse()

  // 3. 如果正在旅行，获取旅行地点信息
  let travelLocation: string | undefined
  let travelDay: number | undefined

  if (capybara.status === 'traveling') {
    const { data: travel } = await supabase
      .from('travels')
      .select('*, travel_locations(name)')
      .eq('user_id', user.id)
      .eq('status', 'traveling')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (travel) {
      const loc = travel.travel_locations as { name: string } | null
      travelLocation = loc?.name
      const startDate = new Date(travel.started_at)
      travelDay = Math.floor((Date.now() - startDate.getTime()) / (5 * 60 * 1000)) + 1
    }
  }

  // 4. 映射 V1 状态到 V2
  const statusMap: Record<string, 'home' | 'traveling' | 'resting'> = {
    home: 'home',
    exploring: 'traveling', // V1 兼容
    traveling: 'traveling',
    visiting: 'traveling',  // V1 兼容
    resting: 'resting',
  }
  const v2Status = statusMap[capybara.status] ?? 'home'

  // 5. 调用 AI（V2 prompt）
  const system = chatSystemPromptV2({
    name: capybara.name,
    traits: capybara.traits as string[],
    mood: capybara.mood,
    status: v2Status,
    memory: (capybara.memory as string[]) || [],
    travelLocation,
    travelDay,
  })

  const prompt = chatUserPrompt(conversations, message)
  const aiResult = await callAI(system, prompt)

  let chatResponse: ChatResponseV2
  if (aiResult) {
    try {
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
      chatResponse = parsed ?? {
        ...fallbackChat(message),
        want_to_travel: false,
        memory_reaction: null,
        memory_extract: null,
      }
      // 兼容 V1 字段名
      if ('want_to_explore' in chatResponse && !('want_to_travel' in chatResponse)) {
        chatResponse.want_to_travel = (chatResponse as unknown as { want_to_explore: boolean }).want_to_explore
      }
    } catch {
      chatResponse = {
        ...fallbackChat(message),
        want_to_travel: false,
        memory_reaction: null,
        memory_extract: null,
      }
    }
  } else {
    chatResponse = {
      ...fallbackChat(message),
      want_to_travel: false,
      memory_reaction: null,
      memory_extract: null,
    }
  }

  // 不在家就不想出去
  if (capybara.status !== 'home') {
    chatResponse.want_to_travel = false
  }

  // 6. 保存对话
  const { data: savedConvo } = await supabase.from('conversations').insert([
    {
      user_id: user.id,
      capybara_id: capybara.id,
      role: 'user',
      content: message,
      keywords: chatResponse.keywords,
    },
    {
      user_id: user.id,
      capybara_id: capybara.id,
      role: 'capybara',
      content: chatResponse.reply,
      mood: chatResponse.mood,
    },
  ]).select('id').limit(1)

  // 7. 更新心情
  await supabase
    .from('capybaras')
    .update({ mood: chatResponse.mood })
    .eq('id', capybara.id)

  // 8. V2 记忆提取（异步，不阻塞响应）
  const memoryResult = await extractMemory(message, conversations)
  let memoryReaction: string | null = null

  if (memoryResult) {
    memoryReaction = memoryReactionText(memoryResult)

    // 存入 memories 表
    await supabase.from('memories').insert({
      user_id: user.id,
      capybara_id: capybara.id,
      topic: memoryResult.topic,
      summary: memoryResult.summary,
      emotion: memoryResult.emotion,
      shareable: memoryResult.shareable,
      sensitive_category: memoryResult.sensitive_category,
      source_conversation_id: savedConvo?.[0]?.id ?? null,
    })

    // 同步更新 capybara.memory（V1 兼容）
    const memory = (capybara.memory as string[]) || []
    const newEntry = `${memoryResult.topic}：${memoryResult.summary}`
    if (memory.length < 20 && !memory.includes(newEntry)) {
      await supabase
        .from('capybaras')
        .update({ memory: [...memory, newEntry] })
        .eq('id', capybara.id)
    }
  }

  return NextResponse.json({
    reply: chatResponse.reply,
    mood: chatResponse.mood,
    keywords: chatResponse.keywords,
    want_to_travel: chatResponse.want_to_travel,
    // V1 兼容
    want_to_explore: chatResponse.want_to_travel,
    capybara_status: capybara.status,
    memory_reaction: memoryReaction,
  })
}
```

- [ ] **Step 2: 确认编译通过**

Run: `cd D:/MyInternship/Jingtong_Internship/Project/Capybara_vercel && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: upgrade chat API with V2 memory extraction and travel-aware prompts"
```

---

## Task 11: 更新 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 重写 CLAUDE.md 为 V2 架构描述**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Capybara (卡皮巴拉养成社交产品) — 用户养一只卡皮巴拉作为 AI Agent，和它分享生活与记忆；卡皮每天出门旅行到真实世界地点，和记忆相似的其他卡皮相遇，让有相似经历的陌生人被温柔连接。MVP stage, migrating to V2 architecture.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:3000)
npm run build     # Production build
npm run start     # Run production server
npm run lint      # ESLint
```

No test runner is configured yet. Design docs live in `docs/product/卡皮巴拉产品设计文档_v2.md`.

## Environment Variables

Required in `.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon key
```

AI providers (at least one recommended, tried in order):
```
DEEPSEEK_API_KEY=   # Primary: deepseek-chat
CLAUDE_API_KEY=     # Fallback: claude-haiku-4-5-20251001
OPENAI_API_KEY=     # Fallback: gpt-4o-mini
```

If all AI keys missing or all providers fail, local template fallbacks kick in automatically.

## Architecture

**Stack:** Next.js 15 (App Router) + React 19 + Supabase (PostgreSQL + Auth + RLS) + Tailwind CSS 3.4. Deployed on Vercel (serverless).

**Path alias:** `@/*` → `./src/*`

### Design Philosophy (V2)

核心命题：让 AI Agent 成为人与人连接的温柔中介，而不是替代。

- **记忆驱动匹配** — 社交不靠标签/颜值/资料，而是基于真实生活体验的共振
- **卡皮是独立角色** — 有自己的意愿、会婉拒、不是百依百顺的工具
- **真实地点旅行** — 卡皮去真实世界的地方（京都、大理、冰岛…），多日旅行
- **每日手记** — 每晚一篇叙事手记，匹配相遇自然融入叙事
- **记忆分档** — 每条记忆自动 AI 分档 shareable/private，用户可在记忆库中手动切换

### Key Directories

- `src/app/api/` — Route handlers:
  - `/chat` — 对话（V2: 集成记忆提取 + 旅行时空感）
  - `/travel` — V2 多日旅行（发起 + 状态查询 + 懒完成）
  - `/journal` — V2 每日手记（生成 + 获取）
  - `/memory` — V2 记忆库管理（查看、切换分档、删除）
  - `/explore` — V1 探索（保留兼容）
  - `/capybara` — 卡皮创建/获取
  - `/visit` — V1 串门（保留兼容）
- `src/lib/ai/client.ts` — Multi-provider AI client with 3-level fallback chain (DeepSeek → Claude → OpenAI → local templates)
- `src/lib/ai/prompts.ts` — All prompt templates. V1 prompts preserved, V2 prompts suffixed with V2. Chat persona: lazy, monosyllabic capybara animal with independent will
- `src/lib/memory/extract.ts` — V2 记忆提取：从对话中识别记忆 → AI 分档 shareable/private → 存入 memories 表
- `src/lib/travel/locations.ts` — V2 真实地点库（MVP ~60 个地点）+ 意向词→地点选择算法
- `src/lib/travel/matching.ts` — V2 全局记忆相似度配对算法（贪心匹配）
- `src/lib/sim/` — Similarity algorithms: Jaccard + weighted Jaccard (V1), memory-based matching (V2)
- `src/lib/supabase/` — Server (`server.ts`) and browser (`client.ts`) Supabase clients
- `src/middleware.ts` — Auth guard: public routes (`/`, `/login`, `/register`), all others require session
- `src/types/index.ts` — Core TypeScript interfaces (V1 + V2 types)
- `src/components/explore/` — 4-stage exploration animation (V1, still functional)
- `supabase/schema.sql` — Core tables + RLS policies
- `supabase/migrations/002_visiting.sql` — V1 social feature tables
- `supabase/migrations/003_v2_structure.sql` — V2 tables (memories, travels, journals, travel_locations, costume_items)

### Core Patterns

**Capybara status machine (V2):** `home` → `traveling` (1-5 days) → `resting` (1-2 days) → `home`. V1 statuses (`exploring`, `visiting`) still recognized for backward compatibility.

**Memory system (V2):** Conversations → AI extracts structured memories → each memory tagged `shareable` or `private` → shareable memories enter matching pool → matched users' capybaras meet at shared real-world locations.

**AI response format:** All AI calls return JSON parsed via regex (`/\{[\s\S]*\}/`). Chat responses include: `reply`, `mood`, `keywords[]`, `want_to_travel`. V2 also extracts memories asynchronously.

**Lazy completion:** Travels complete when frontend polls `GET /api/travel` and `estimated_return <= now`. No background jobs — serverless-friendly.

**Real-world locations:** ~60 locations across 6 regions. Intent keywords from conversations map to location tags. 30-day cooldown per location.

**Memory privacy (V2):**
- AI auto-classifies: family details, health, finance, legal → `private`
- Interests, emotions, childhood themes, lifestyle → `shareable`
- Users can manually toggle in memory library
- Only `shareable=true` memories enter matching pool
- Sensitive topics (crisis, self-harm) → special handling, never enter pool

**RLS everywhere:** All Supabase tables enforce Row Level Security.

### Social System (V2)

- **V2 mechanism:** Memory-driven matching replaces V1 persona card matching
  - Daily global matching: all traveling users paired by memory similarity
  - Paired users sent to same real-world location
  - Encounter naturally woven into daily journal narrative
  - Journal → visit other's space → leave message → 1v1 chat
- **V1 mechanism (preserved):** `persona_cards` + `visits` + `user_affinity` still functional

### Tailwind Theme

Custom color palettes: `capybara` (brown), `river` (blue), `meadow` (green). Global bg: `from-meadow-50 to-river-50`.

### Database Setup

1. Create Supabase project
2. Run `supabase/schema.sql` (core tables: profiles, capybaras, conversations, explorations)
3. Run `supabase/migrations/002_visiting.sql` (V1 social tables)
4. Run `supabase/migrations/003_v2_structure.sql` (V2 tables: memories, travels, journals, travel_locations, costume_items)
5. Profiles auto-created via trigger on auth.users insert
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect V2 architecture"
```

---

## Task 12: 验证整体编译

**Files:** None (验证步骤)

- [ ] **Step 1: 运行 TypeScript 编译检查**

Run: `cd D:/MyInternship/Jingtong_Internship/Project/Capybara_vercel && npx tsc --noEmit --pretty 2>&1`
Expected: 无 error（warning 可接受）

- [ ] **Step 2: 运行 lint**

Run: `cd D:/MyInternship/Jingtong_Internship/Project/Capybara_vercel && npm run lint 2>&1`
Expected: 无 error

- [ ] **Step 3: 运行 build**

Run: `cd D:/MyInternship/Jingtong_Internship/Project/Capybara_vercel && npm run build 2>&1`
Expected: Build 成功

- [ ] **Step 4: 修复编译/lint 错误（如有）**

根据 Step 1-3 的输出修复所有问题。

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: resolve any compilation issues from V2 migration"
```
