# M7: Supabase 基础设施模块 (`supabase`)

> 提供数据库连接、Auth 集成和行级安全（RLS）策略，是所有业务模块的数据访问基础。

---

## 模块概览

| 属性 | 说明 |
|------|------|
| 职责 | 数据库连接、Auth 集成、RLS 安全 |
| 入口 | `src/lib/supabase/client.ts`, `server.ts` |
| 模式 | Browser Client (客户端) + Server Client (API 路由) |

---

## 客户端类型

系统使用两种 Supabase 客户端，分别用于不同场景。

| 类型 | 用途 | Cookie 处理 |
|------|------|------------|
| Browser Client | 页面中直接查询/订阅 | 自动（`createBrowserClient`） |
| Server Client | API Route 中查询 | 手动读写 Cookie（`cookies()` async） |

### Browser Client

- 运行在浏览器端
- 通过 `createBrowserClient` 创建
- 自动管理 Cookie 中的认证 token
- 用于页面组件中的数据查询和实时订阅

### Server Client

- 运行在服务端（API Routes / Server Components）
- 通过手动读写 `cookies()` 管理认证状态
- 用于需要服务端权限的数据操作
- 每次请求创建新实例，确保会话隔离

---

## RLS 策略

所有表均启用行级安全（Row Level Security），确保数据隔离。

### capybaras 表：仅所有者可读写

```sql
CREATE POLICY "用户只能操作自己的卡皮巴拉"
  ON capybaras FOR ALL
  USING (auth.uid() = owner_id);
```

### conversations 表：仅所有者可读写

```sql
-- 读取策略
CREATE POLICY "用户只能查看自己的对话"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

-- 写入策略
CREATE POLICY "用户只能创建自己的对话"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### explorations 表：仅所有者可读写

```sql
CREATE POLICY "用户只能操作自己的探索"
  ON explorations FOR ALL
  USING (auth.uid() = user_id);
```

### profiles 表：公开可读

```sql
CREATE POLICY "个人资料公开可读"
  ON profiles FOR SELECT
  USING (true);
```

---

## V2 新增表

V2 引入记忆、旅行、手记、地点和装扮系统，新增以下数据库表。

### memories 表 — 结构化记忆

从对话中 AI 提取的记忆条目，支持公开/私密分类。

```sql
CREATE TABLE memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capybara_id   UUID NOT NULL REFERENCES capybaras(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL,                -- 记忆主题（如 "喜欢雨天散步"）
  emotion       TEXT NOT NULL DEFAULT 'calm', -- 情绪标签
  intent        TEXT NOT NULL DEFAULT 'share',-- 意图分类
  shareable     BOOLEAN NOT NULL DEFAULT true,-- 是否可公开
  source_conversation_id UUID REFERENCES conversations(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### travels 表 — 多日旅行

卡皮巴拉的 1-5 天旅行记录，替代 V1 的短时探索。

```sql
CREATE TABLE travels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capybara_id     UUID NOT NULL REFERENCES capybaras(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL REFERENCES travel_locations(id),
  status          TEXT NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned', 'traveling', 'completed')),
  duration_days   INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 5),
  matched_user_id UUID REFERENCES auth.users(id), -- 旅途中匹配的用户
  journal_id      UUID,                           -- 关联手记（旅行完成后填充）
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);
```

### journals 表 — 每日手记

Webtoon 风格叙事手记，包含旅途日记和可选的偶遇片段。

```sql
CREATE TABLE journals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id         UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content           JSONB NOT NULL DEFAULT '{}',   -- 面板序列 { panels: [...] }
  encounter_segment JSONB,                         -- 偶遇片段 { panels: [...], affinity_hint }
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### travel_locations 表 — 旅行目的地

真实世界地点库，供旅行生成使用。

```sql
CREATE TABLE travel_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,             -- 地点名称（如 "镰仓"）
  country     TEXT NOT NULL,             -- 国家
  region      TEXT,                      -- 地区/省份
  description TEXT,                      -- 地点描述
  coordinates POINT,                     -- 经纬度坐标
  tags        TEXT[] NOT NULL DEFAULT '{}', -- 标签（如 ['海边','温泉','历史']）
  climate     TEXT,                      -- 气候类型
  best_season TEXT                       -- 最佳旅行季节
);
```

### costume_items 表 — 装扮物品

卡皮巴拉可穿戴的装扮物品。

```sql
CREATE TABLE costume_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slot          TEXT NOT NULL CHECK (slot IN ('head', 'body', 'tail', 'accessory')),
  rarity        TEXT NOT NULL DEFAULT 'common'
                CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),
  obtain_method TEXT,                    -- 获取方式（travel/gift/achievement）
  image_url     TEXT
);
```

---

## V2 RLS 策略

### memories 表

```sql
-- 所有者完全控制
CREATE POLICY "用户可管理自己的记忆"
  ON memories FOR ALL
  USING (auth.uid() = user_id);

-- 匹配用户仅可查看公开记忆
CREATE POLICY "匹配用户可查看公开记忆"
  ON memories FOR SELECT
  USING (
    shareable = true
    AND user_id IN (
      SELECT matched_user_id FROM travels WHERE user_id = auth.uid()
      UNION
      SELECT user_id FROM travels WHERE matched_user_id = auth.uid()
    )
  );
```

### travels 表

```sql
CREATE POLICY "用户只能操作自己的旅行"
  ON travels FOR ALL
  USING (auth.uid() = user_id);
```

### journals 表

```sql
-- 所有者可读
CREATE POLICY "用户可查看自己的手记"
  ON journals FOR ALL
  USING (auth.uid() = user_id);

-- 偶遇对方可查看包含自己的偶遇片段
CREATE POLICY "偶遇用户可查看相关手记"
  ON journals FOR SELECT
  USING (
    encounter_segment IS NOT NULL
    AND travel_id IN (
      SELECT id FROM travels
      WHERE matched_user_id = auth.uid()
    )
  );
```

### travel_locations 表

```sql
-- 公开可读（地点库对所有用户开放）
CREATE POLICY "旅行地点公开可读"
  ON travel_locations FOR SELECT
  USING (true);
```

### costume_items 表

```sql
-- 物品定义公开可读
CREATE POLICY "装扮物品公开可读"
  ON costume_items FOR SELECT
  USING (true);

-- 注：用户装扮库存通过关联表（capybara_costumes）管理，
-- 该表 RLS 基于 owner_id 控制写入权限
```

---

## V2 数据库索引

| 索引名 | 表 | 列 | 用途 |
|-------|---|---|------|
| `idx_memories_user_shareable` | memories | (user_id, shareable) | 按用户查询公开/私密记忆 |
| `idx_travels_user_status` | travels | (user_id, status) | 查询用户当前/历史旅行 |
| `idx_journals_user_time` | journals | (user_id, published_at DESC) | 按时间获取手记列表 |
| `idx_travel_locations_tags` | travel_locations | tags (GIN) | 按标签搜索目的地 |

```sql
CREATE INDEX idx_memories_user_shareable ON memories (user_id, shareable);
CREATE INDEX idx_travels_user_status ON travels (user_id, status);
CREATE INDEX idx_journals_user_time ON journals (user_id, published_at DESC);
CREATE INDEX idx_travel_locations_tags ON travel_locations USING GIN (tags);
```

---

## 数据库索引

| 索引名 | 表 | 列 | 用途 |
|-------|---|---|------|
| `idx_conversations_user_time` | conversations | (user_id, created_at DESC) | 按时间获取对话历史 |
| `idx_explorations_user_status` | explorations | (user_id, status) | 查询进行中的探索 |
| `capybaras_owner_id_key` | capybaras | owner_id (UNIQUE) | 确保一人一只 |

---

## ER 关系图

```
┌──────────────┐     1:1     ┌──────────────┐
│   auth.users │────────────→│   profiles   │
│              │             │              │
│  id (PK)     │             │ id (PK, FK)  │
│  email       │             │ nickname     │
│  ...         │             │ avatar_url   │
└──────┬───────┘             └──────────────┘
       │
       │ 1:1
       ▼
┌──────────────┐
│  capybaras   │
│              │
│ id (PK)      │
│ owner_id (FK)│── UNIQUE
│ name         │
│ traits[]     │
│ mood         │
│ status       │  V2: home/traveling/resting
│ memory[]     │
│ experience   │
│ level        │
└──┬──┬──┬─────┘
   │  │  │
   │  │  │1:N                    ┌─────────────────┐
   │  │  └──────────────────────→│   memories (V2) │
   │  │                          │                 │
   │  │                          │ id (PK)         │
   │  │                          │ capybara_id (FK)│
   │  │                          │ user_id (FK)    │
   │  │                          │ topic           │
   │  │                          │ emotion         │
   │  │                          │ intent          │
   │  │                          │ shareable       │
   │  │                          │ source_conv_id  │
   │  │                          │ created_at      │
   │  │                          └─────────────────┘
   │  │
   │  │1:N          ┌───────────────────┐
   │  └────────────→│   travels (V2)    │
   │                │                   │
   │                │ id (PK)           │
   │                │ capybara_id (FK)  │
   │                │ user_id (FK)      │
   │                │ location_id (FK) ─┼──→ travel_locations
   │                │ status            │    (V2, 公开地点库)
   │                │ duration_days     │
   │                │ matched_user_id   │
   │                │ started_at        │
   │                │ completed_at      │
   │                └────────┬──────────┘
   │                         │ 1:N
   │                         ▼
   │                ┌───────────────────┐
   │                │  journals (V2)    │
   │                │                   │
   │                │ id (PK)           │
   │                │ travel_id (FK)    │
   │                │ user_id (FK)      │
   │                │ content (JSONB)   │
   │                │ encounter_segment │
   │                │ published_at      │
   │                └───────────────────┘
   │
   │1:N       1:N
   ├─────┐
   ▼     ▼
┌──────────────┐  ┌───────────────┐  ┌───────────────────┐
│conversations │  │ explorations  │  │ costume_items (V2) │
│              │  │  (V1)         │  │   (公开物品定义)    │
│ id (PK)      │  │               │  │                   │
│ user_id (FK) │  │ id (PK)       │  │ id (PK)           │
│ capybara_id  │  │ user_id (FK)  │  │ name              │
│ role         │  │ capybara_id   │  │ slot              │
│ content      │  │ status        │  │ rarity            │
│ mood         │  │ type          │  │ obtain_method     │
│ keywords[]   │  │ keywords[]    │  │ image_url         │
│ created_at   │  │ story         │  └───────────────────┘
└──────────────┘  │ items_found[] │
                  │ started_at    │
                  │ estimated_ret │
                  │ completed_at  │
                  └───────────────┘
```

---

## 环境变量

| 变量名 | 必需 | 暴露给前端 | 说明 |
|-------|------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | 是 | Supabase 匿名 Key |

---

## 数据安全措施

| 措施 | 实现 |
|------|------|
| RLS | 所有表启用行级安全策略 |
| SQL 注入 | Supabase SDK 参数化查询 |
| API Key | 服务端环境变量，不暴露给前端 |
| 会话管理 | httpOnly + Secure + SameSite=Lax Cookie |

---

## 相关文件

```
src/
├── lib/supabase/
│   ├── client.ts               # 浏览器端 Supabase 客户端
│   └── server.ts               # 服务端 Supabase 客户端
└── types/index.ts               # 数据库类型定义

supabase/
├── schema.sql                   # V1 核心表（profiles, capybaras, conversations, explorations）
└── migrations/
    ├── 002_visiting.sql         # V1 社交表（persona_cards, visits, user_affinity）
    └── 003_v2_tables.sql        # V2 新增表（memories, travels, journals, travel_locations, costume_items）
```

---

*模块文档 | 源自 05-项目架构与工程实现 §2.2 M7*
