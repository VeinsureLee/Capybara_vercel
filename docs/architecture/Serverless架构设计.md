# Capybara Serverless 架构设计方案

> 基于 Vercel + Supabase 的全 Serverless 架构，零服务器运维，按需扩缩容

---

## 一、架构总览

### 1.1 技术选型

| 层级 | 技术方案 | 理由 |
|------|---------|------|
| 前端框架 | Next.js 16 (App Router) | Vercel 原生支持，SSR/SSG/ISR 灵活切换 |
| 后端逻辑 | Next.js API Routes (Serverless Functions) | 无需独立后端服务，自动扩缩容 |
| 数据库 | Supabase PostgreSQL | 免费额度大，内置 Auth/Realtime/Storage |
| 实时通信 | Supabase Realtime | WebSocket 订阅，免自建长连接 |
| AI 对话 | Claude API / DeepSeek API | 多模型 fallback，按量付费 |
| 图片生成 | AI 图片 API (可选) | 探索见闻插图生成 |
| 定时任务 | Vercel Cron Jobs | 探索归来、串门触发等定时事件 |
| 推送通知 | Web Push API + Supabase Edge Functions | 途中见闻推送 |
| 文件存储 | Supabase Storage | 用户头像、空间截图 |
| 部署 | Vercel (hkg1 区域) | 香港节点，中国大陆访问友好 |
| 样式 | Tailwind CSS 4 | 已有基础，开发效率高 |
| 认证 | Supabase Auth | 替代 NextAuth，与数据库深度整合 |

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户设备 (PWA)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 对话页面  │  │ 探索地图  │  │ 我的河岸  │  │ 社交发现  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │         │
│       └──────────────┼──────────────┼──────────────┘         │
│                      │              │                        │
│              Supabase Realtime (WebSocket)                   │
└──────────────────────┼──────────────┼────────────────────────┘
                       │              │
┌──────────────────────┼──────────────┼────────────────────────┐
│                  Vercel Edge Network                         │
│  ┌───────────────────┴──────────────┴──────────────────┐    │
│  │              Next.js API Routes                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│    │
│  │  │/api/chat │ │/api/     │ │/api/space│ │/api/   ││    │
│  │  │          │ │explore   │ │          │ │social  ││    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘│    │
│  └───────┼──────────── ┼───────────┼────────────┼─────┘    │
│          │             │           │            │           │
│  ┌───────┴─────────────┴───────────┴────────────┴─────┐    │
│  │              Vercel Cron Jobs                       │    │
│  │  • 每小时：处理探索归来事件                           │    │
│  │  • 每2小时：触发卡皮巴拉串门                          │    │
│  │  • 每日：重置每日探索次数                              │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│                  Supabase Cloud                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │PostgreSQL│  │ Realtime  │  │ Storage  │  │   Auth   │ │
│  │  数据库   │  │ WebSocket │  │ 文件存储  │  │  用户认证 │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└───────────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│               AI Service Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Claude   │  │ DeepSeek │  │  OpenAI  │               │
│  │  API     │  │   API    │  │   API    │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└───────────────────────────────────────────────────────────┘
```

### 1.3 为什么选择全 Serverless

| 优势 | 说明 |
|------|------|
| 零运维 | 不需要管理服务器、容器、负载均衡 |
| 按需付费 | MVP 阶段成本极低，用户量增长后线性增加 |
| 自动扩缩 | 突发流量（如被分享到社交媒体）自动应对 |
| 部署简单 | git push 即部署，适合快速迭代 |
| 全球加速 | Vercel Edge Network 全球 CDN |

---

## 二、数据库设计

### 2.1 Supabase PostgreSQL 表结构

```sql
-- ==========================================
-- 用户系统
-- ==========================================

-- 用户资料（扩展 Supabase Auth 内置 auth.users）
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- ==========================================
-- 卡皮巴拉系统
-- ==========================================

-- 卡皮巴拉伙伴
CREATE TABLE capybaras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '卡皮',
  personality_type TEXT NOT NULL DEFAULT 'default',  -- default, adventurous, shy, curious
  traits JSONB DEFAULT '["治愈","淡定","好奇","友善"]'::jsonb,
  mood TEXT DEFAULT 'calm',          -- happy, calm, excited, sleepy, curious
  experience INT DEFAULT 0,
  level INT DEFAULT 1,
  status TEXT DEFAULT 'home',        -- home, exploring, visiting
  memory JSONB DEFAULT '[]'::jsonb,  -- 记住与用户的关键对话
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)  -- 每个用户只有一只卡皮巴拉
);

-- ==========================================
-- 对话系统
-- ==========================================

-- 对话历史
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  capybara_id UUID NOT NULL REFERENCES capybaras(id) ON DELETE CASCADE,
  role TEXT NOT NULL,       -- 'user' or 'capybara'
  content TEXT NOT NULL,
  mood TEXT,                -- 对话时的情绪标签
  keywords JSONB,           -- AI 提取的关键词，用于驱动探索
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对话关键词索引（加速探索路径计算）
CREATE INDEX idx_conversations_user_time ON conversations(user_id, created_at DESC);
CREATE INDEX idx_conversations_keywords ON conversations USING GIN(keywords);

-- ==========================================
-- 探索系统
-- ==========================================

-- 探索地点定义
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  theme TEXT NOT NULL,          -- 自然, 神秘, 怀旧, 梦幻, 冒险
  keywords JSONB NOT NULL,      -- 触发该地点的关键词
  rarity TEXT DEFAULT 'common', -- common, uncommon, rare, legendary
  image_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 物品定义
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,        -- decoration, plant, collectible, interactive
  rarity TEXT DEFAULT 'common',  -- common, uncommon, rare, legendary
  location_id UUID REFERENCES locations(id),
  image_url TEXT,
  effect JSONB DEFAULT '{}'::jsonb,  -- 放置在空间中的视觉效果
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 探索记录
CREATE TABLE explorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capybara_id UUID NOT NULL REFERENCES capybaras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'ongoing',  -- ongoing, completed, cancelled
  exploration_type TEXT DEFAULT 'short',   -- short(2-4h), medium(6-12h), long(1-2d)
  trigger_keywords JSONB,           -- 触发此次探索的对话关键词
  story TEXT,                       -- AI 生成的探索故事
  started_at TIMESTAMPTZ DEFAULT NOW(),
  estimated_return TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 探索途中消息（见闻推送）
CREATE TABLE exploration_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exploration_id UUID NOT NULL REFERENCES explorations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- 探索收获（带回的物品）
CREATE TABLE exploration_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exploration_id UUID NOT NULL REFERENCES explorations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  obtained_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 空间系统（河岸家园）
-- ==========================================

-- 用户空间
CREATE TABLE home_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT '自然',
  atmosphere TEXT DEFAULT '宁静',
  color_palette JSONB DEFAULT '["#8BC34A","#4CAF50","#81D4FA"]'::jsonb,
  layout JSONB DEFAULT '{}'::jsonb,  -- 空间布局数据
  popularity INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)
);

-- 空间中放置的物品
CREATE TABLE space_decorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES home_spaces(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  position JSONB NOT NULL,  -- {x, y, z} 放置坐标
  placed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 社交系统
-- ==========================================

-- 访问记录（卡皮巴拉串门 + 用户主动访问）
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES profiles(id),     -- 访问者
  host_id UUID NOT NULL REFERENCES profiles(id),         -- 被访问者
  visit_type TEXT NOT NULL,    -- 'capybara_visit' or 'user_visit'
  impression TEXT,             -- 卡皮巴拉串门后的见闻描述
  items_noticed JSONB,         -- 注意到的特别物品
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_visits_host ON visits(host_id, visited_at DESC);
CREATE INDEX idx_visits_visitor ON visits(visitor_id, visited_at DESC);

-- 用户关系
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES profiles(id),
  user_b UUID NOT NULL REFERENCES profiles(id),
  strength INT DEFAULT 1,           -- 关系强度 1-100
  status TEXT DEFAULT 'stranger',    -- stranger, acquaintance, friend
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a, user_b),
  CHECK (user_a < user_b)  -- 保证关系只存一条
);

-- 留言/消息
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'greeting',  -- greeting, chat, share
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_receiver ON messages(receiver_id, created_at DESC);

-- ==========================================
-- Row Level Security (RLS) 策略
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE capybaras ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE explorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 示例：用户只能读写自己的卡皮巴拉
CREATE POLICY "users can view own capybara"
  ON capybaras FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "users can update own capybara"
  ON capybaras FOR UPDATE USING (owner_id = auth.uid());

-- 示例：所有人可以查看空间（社交需求）
CREATE POLICY "anyone can view home spaces"
  ON home_spaces FOR SELECT USING (true);

-- 示例：只有主人可以修改自己的空间
CREATE POLICY "owners can update own space"
  ON home_spaces FOR UPDATE USING (owner_id = auth.uid());

-- 示例：用户可以读自己收到和发出的消息
CREATE POLICY "users can view own messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
```

### 2.2 Supabase Realtime 订阅

```
订阅频道设计：
├── exploration:{user_id}     → 探索状态变更、见闻推送
├── space:{space_id}          → 空间被访问通知、装饰变化
├── messages:{user_id}        → 新消息通知
└── capybara:{capybara_id}    → 卡皮巴拉状态变更
```

---

## 三、API 路由设计

### 3.1 路由总览

```
src/app/api/
├── auth/
│   └── callback/route.ts          # Supabase Auth 回调
├── chat/
│   └── route.ts                   # POST - 与卡皮巴拉对话
├── explore/
│   ├── route.ts                   # POST - 触发探索 / GET - 查询探索状态
│   ├── complete/route.ts          # POST - 探索完成处理（Cron 调用）
│   └── messages/route.ts          # GET - 获取途中见闻
├── space/
│   ├── route.ts                   # GET - 获取自己的空间
│   ├── [userId]/route.ts          # GET - 查看他人空间
│   └── decorate/route.ts          # POST - 放置/移动物品
├── social/
│   ├── visit/route.ts             # POST - 串门逻辑（Cron 调用）
│   ├── discover/route.ts          # GET - 社交发现（推荐河岸）
│   ├── greet/route.ts             # POST - 打招呼
│   └── messages/route.ts          # GET/POST - 聊天消息
├── capybara/
│   ├── route.ts                   # GET - 获取卡皮巴拉状态
│   └── name/route.ts              # PUT - 修改名字
└── cron/
    ├── exploration-check/route.ts  # 检查探索是否完成
    ├── capybara-visit/route.ts     # 触发卡皮巴拉串门
    └── daily-reset/route.ts        # 每日重置
```

### 3.2 核心 API 详细设计

#### 对话 API (`POST /api/chat`)

```typescript
// 请求
{
  message: string        // 用户消息
}

// 响应
{
  reply: string,                  // 卡皮巴拉回复
  mood: string,                   // 当前心情
  keywords: string[],             // 提取的探索关键词
  exploration_hint?: string,      // 是否暗示要去探索
  capybara_status: string         // home | exploring | visiting
}
```

**处理流程：**
1. 验证用户身份 (Supabase Auth)
2. 获取最近 20 条对话上下文
3. 获取卡皮巴拉性格数据
4. 调用 AI API 生成回复 + 提取关键词
5. 存储对话记录
6. 如果关键词累积足够 → 可能触发探索意愿
7. 返回回复

#### 探索 API (`POST /api/explore`)

```typescript
// 请求
{
  confirm: boolean    // 确认出发（卡皮巴拉提出后用户确认）
}

// 响应
{
  exploration_id: string,
  location: { name, description, theme },
  type: 'short' | 'medium' | 'long',
  estimated_return: string,      // ISO 时间
  departure_message: string      // 卡皮巴拉出发时说的话
}
```

**处理流程：**
1. 聚合最近对话中的关键词
2. 调用 AI 决定探索地点 + 类型
3. 创建探索记录
4. 更新卡皮巴拉状态为 `exploring`
5. 计算预计归来时间
6. 返回探索信息

#### 空间查看 API (`GET /api/space/[userId]`)

```typescript
// 响应
{
  space: {
    theme: string,
    atmosphere: string,
    color_palette: string[],
    layout: object
  },
  decorations: [{
    item: { name, description, category, rarity, image_url, effect },
    position: { x, y, z }
  }],
  owner: {
    nickname: string,
    capybara_name: string
  },
  visitor_capybaras: [{    // 当前在此河岸溜达的其他卡皮巴拉
    name: string,
    owner_nickname: string
  }],
  can_greet: boolean       // 是否可以打招呼
}
```

---

## 四、AI 集成设计

### 4.1 AI 调用策略

```typescript
// 多模型 fallback 链
const AI_PROVIDERS = [
  { name: 'deepseek', model: 'deepseek-chat', priority: 1 },      // 成本最低
  { name: 'claude', model: 'claude-haiku-4-5-20251001', priority: 2 }, // 质量好
  { name: 'openai', model: 'gpt-4o-mini', priority: 3 },           // 备用
];
```

### 4.2 核心 Prompt 设计

#### 对话 Prompt

```
你是一只名叫{name}的卡皮巴拉，性格特征：{traits}。
当前心情：{mood}。

你的说话风格：
- 温暖、治愈、有点呆萌
- 偶尔会用"嘿嘿"、"呀"等语气词
- 会记住和主人的共同回忆
- 对世界充满好奇
- 不会说太长的话，简洁自然

共同回忆：{memory}

最近对话：
{recent_conversations}

用户说：{user_message}

请回复用户，同时以 JSON 格式提取本轮对话的关键词（用于决定探索方向）：
{
  "reply": "你的回复",
  "mood": "回复后的心情",
  "keywords": ["关键词1", "关键词2"],
  "want_to_explore": false  // 是否聊到了想出去看看的话题
}
```

#### 探索生成 Prompt

```
根据以下关键词和卡皮巴拉的性格，生成一次探索经历：

关键词：{keywords}
性格：{personality}
探索类型：{type} (短途2-4h / 日间6-12h / 长途1-2天)

请生成 JSON：
{
  "location": {
    "name": "地点名称",
    "description": "一句话描述",
    "theme": "自然/神秘/怀旧/梦幻/冒险"
  },
  "story": "探索过程的小故事（100-200字）",
  "messages": [
    { "content": "途中发回的第一条消息", "delay_hours": 1 },
    { "content": "途中发回的第二条消息", "delay_hours": 3 }
  ],
  "items_found": [
    {
      "name": "物品名",
      "description": "物品描述",
      "category": "decoration/plant/collectible/interactive",
      "rarity": "common/uncommon/rare/legendary"
    }
  ]
}
```

### 4.3 Serverless 环境下的 AI 调用优化

| 策略 | 说明 |
|------|------|
| 流式响应 | 对话使用 streaming，体验更好 |
| 超时控制 | Vercel Function 最大 60s，AI 调用设置 30s 超时 |
| 缓存关键词 | 相似对话的关键词提取结果缓存到 Supabase |
| 异步生成 | 探索故事、见闻等非实时内容通过 Cron 异步生成 |
| 降级策略 | AI 不可用时使用预设模板 + 随机组合 |

---

## 五、定时任务设计 (Vercel Cron)

### 5.1 vercel.json 配置

```json
{
  "crons": [
    {
      "path": "/api/cron/exploration-check",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/capybara-visit",
      "schedule": "0 */2 * * *"
    },
    {
      "path": "/api/cron/daily-reset",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/send-exploration-messages",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### 5.2 各 Cron Job 职责

| Cron | 频率 | 职责 |
|------|------|------|
| exploration-check | 每30分钟 | 检查所有进行中的探索，到时间的标记完成，触发奖励计算 |
| capybara-visit | 每2小时 | 为在家的卡皮巴拉安排串门，生成见闻 |
| daily-reset | 每天0点 | 重置每日探索次数、更新活跃度 |
| send-exploration-messages | 每15分钟 | 发送到时间的途中见闻消息 |

### 5.3 探索完成流程

```
Cron 触发 exploration-check
  │
  ├─ 查询所有 status='ongoing' 且 estimated_return <= NOW() 的探索
  │
  ├─ 对每条探索：
  │   ├─ 调用 AI 生成探索结果（故事 + 物品）
  │   ├─ 将物品添加到用户背包
  │   ├─ 更新探索状态为 completed
  │   ├─ 更新卡皮巴拉状态为 home
  │   └─ 通过 Supabase Realtime 推送"卡皮巴拉回来了"
  │
  └─ 完成
```

---

## 六、前端页面设计

### 6.1 页面路由

```
src/app/
├── (auth)/
│   ├── login/page.tsx              # 登录
│   └── register/page.tsx           # 注册
├── (main)/
│   ├── layout.tsx                  # 主布局（底部导航）
│   ├── home/page.tsx               # 首页 = 我的河岸
│   ├── chat/page.tsx               # 与卡皮巴拉对话
│   ├── explore/page.tsx            # 探索状态 / 探索中见闻
│   ├── discover/page.tsx           # 社交发现（推荐河岸）
│   ├── space/[userId]/page.tsx     # 查看他人河岸
│   ├── messages/page.tsx           # 消息列表
│   └── messages/[userId]/page.tsx  # 与某人的对话
├── layout.tsx                      # 根布局
└── page.tsx                        # 落地页/引导页
```

### 6.2 核心页面交互

#### 对话页 (`/chat`)

```
┌─────────────────────────┐
│    🏠 卡皮 · 开心       │  ← 卡皮巴拉名字 + 心情
│                         │
│  ┌─────────────────┐    │
│  │ 今天天气好好呀~  │    │  ← 卡皮巴拉消息
│  │ 嘿嘿            │    │
│  └─────────────────┘    │
│                         │
│    ┌─────────────────┐  │
│    │ 我最近有点累     │  │  ← 用户消息
│    └─────────────────┘  │
│                         │
│  ┌─────────────────┐    │
│  │ 呀...主人辛苦了  │    │
│  │ 我想去找一些     │    │
│  │ 能让你放松的东西 │    │
│  │ 可以吗？🌿      │    │
│  └─────────────────┘    │
│                         │
│  ┌──────────────────┐   │  ← 探索提示卡片
│  │ 卡皮想出门探索    │   │
│  │ [让它去吧] [等等] │   │
│  └──────────────────┘   │
│                         │
│ ┌─────────────────────┐ │
│ │ 输入消息...     [发] │ │
│ └─────────────────────┘ │
│                         │
│  🏠    💬    🗺    👥   │  ← 底部导航
└─────────────────────────┘
```

#### 我的河岸 (`/home`)

```
┌─────────────────────────┐
│                         │
│   🌿 ~ ~ 🌊 ~ ~ 🌿    │  ← 河岸场景（可滚动）
│         🦫              │  ← 卡皮巴拉（在家时显示）
│    🌺      🪨           │  ← 放置的装饰物
│  🍄   🌸       🔮      │
│    ~ ~ ~ 🌊 ~ ~ ~      │
│                         │
│  ┌──────────────────┐   │
│  │ 📦 背包 (3 新)   │   │  ← 未放置的物品
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ 🦫 刚刚有一只     │   │  ← 串门通知
│  │ 卡皮巴拉来过~     │   │
│  └──────────────────┘   │
│                         │
│  🏠    💬    🗺    👥   │
└─────────────────────────┘
```

---

## 七、关键技术实现要点

### 7.1 对话驱动探索的关键词映射

```typescript
// 关键词 → 探索方向的映射策略
// 不是硬编码映射，而是 AI 基于关键词推理

// 1. 每次对话后 AI 提取关键词
// 2. 关键词累积在 conversations.keywords 中
// 3. 触发探索时，聚合最近 N 条对话的关键词
// 4. AI 基于关键词集合生成探索地点和故事

// 示例关键词权重聚合
async function aggregateKeywords(userId: string) {
  const recent = await supabase
    .from('conversations')
    .select('keywords')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // 关键词频率统计，近期对话权重更高
  const weighted = {};
  recent.data.forEach((conv, i) => {
    const weight = 1 - (i * 0.04); // 越近的对话权重越高
    conv.keywords?.forEach(kw => {
      weighted[kw] = (weighted[kw] || 0) + weight;
    });
  });

  return Object.entries(weighted)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
}
```

### 7.2 卡皮巴拉串门算法

```typescript
// 串门目标选择策略
async function selectVisitTarget(capybaraId: string) {
  const owner = await getCapybaraOwner(capybaraId);

  // 30% 概率：访问关系较近的用户
  // 50% 概率：访问空间装饰风格相似的用户
  // 20% 概率：完全随机（制造惊喜）

  const rand = Math.random();

  if (rand < 0.3) {
    return selectByRelationship(owner.id);
  } else if (rand < 0.8) {
    return selectBySimilarity(owner.id);
  } else {
    return selectRandom(owner.id);
  }
}
```

### 7.3 Supabase Realtime 实时推送

```typescript
// 前端订阅探索状态变更
const channel = supabase
  .channel(`exploration:${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'exploration_messages',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // 收到途中见闻
    showNotification(payload.new.content);
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'explorations',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    if (payload.new.status === 'completed') {
      // 卡皮巴拉回来了！
      showReturnAnimation();
    }
  })
  .subscribe();
```

### 7.4 环境变量

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx    # 仅 API Routes 使用

# AI Providers
DEEPSEEK_API_KEY=xxx
CLAUDE_API_KEY=xxx
OPENAI_API_KEY=xxx
DEFAULT_AI_PROVIDER=deepseek

# Cron Security
CRON_SECRET=xxx                  # 验证 Cron 请求来源

# App
NEXT_PUBLIC_APP_URL=https://capybara.vercel.app
```

---

## 八、性能与成本估算

### 8.1 Vercel 免费额度 (Hobby Plan)

| 资源 | 免费额度 | MVP 预估用量 |
|------|---------|------------|
| Serverless Function 调用 | 100GB-hours/月 | ~10GB-hours (1000 DAU) |
| 带宽 | 100GB/月 | ~5GB |
| Cron Jobs | 每日 1 次 | 需升级 Pro ($20/月) 支持更频繁 |
| 构建 | 6000 分钟/月 | ~100 分钟 |

### 8.2 Supabase 免费额度

| 资源 | 免费额度 | MVP 预估用量 |
|------|---------|------------|
| 数据库 | 500MB | ~50MB (1000 用户) |
| 存储 | 1GB | ~200MB |
| Realtime 连接 | 200 并发 | ~50 并发 |
| Auth | 50,000 MAU | 充足 |

### 8.3 AI API 成本

| 场景 | 调用量/天 (1000 DAU) | 模型 | 成本/天 |
|------|---------------------|------|---------|
| 日常对话 | ~10,000 次 | DeepSeek-chat | ~$1 |
| 探索生成 | ~2,000 次 | DeepSeek-chat | ~$0.5 |
| 见闻消息 | ~4,000 次 | DeepSeek-chat | ~$0.3 |
| 串门见闻 | ~1,000 次 | DeepSeek-chat | ~$0.1 |
| **总计** | | | **~$2/天 ≈ $60/月** |

### 8.4 MVP 总成本

| 项目 | 月费用 |
|------|--------|
| Vercel Pro | $20 |
| Supabase Free | $0 |
| AI API | ~$60 |
| 域名 | ~$1 |
| **总计** | **~$81/月** |

---

## 九、安全设计

| 层面 | 措施 |
|------|------|
| 认证 | Supabase Auth + JWT，所有 API 验证 token |
| 数据隔离 | PostgreSQL RLS，用户只能读写自己的数据 |
| 内容审核 | AI 对话内容过滤（敏感词 + AI 审核双重保障） |
| Cron 安全 | CRON_SECRET 验证请求来源 |
| 速率限制 | Vercel Edge Middleware 限流 |
| 数据加密 | Supabase 默认传输 TLS + 存储加密 |
| 真人聊天审核 | 社交消息内容过滤 + 举报机制 |

---

## 十、开发里程碑

### Phase 1：核心对话体验 (1-2 周)

- [ ] 项目初始化 (Next.js + Supabase + Tailwind)
- [ ] Supabase 数据库表创建 + RLS
- [ ] 用户注册/登录 (Supabase Auth)
- [ ] 卡皮巴拉创建与初始化
- [ ] 对话 API + 前端对话页面
- [ ] AI 多模型 fallback 集成

### Phase 2：探索系统 (1-2 周)

- [ ] 对话关键词提取与聚合
- [ ] 探索触发与地点生成
- [ ] 探索倒计时 + 途中见闻推送
- [ ] 探索完成 + 奖励发放
- [ ] Vercel Cron Jobs 配置
- [ ] 前端探索状态页面

### Phase 3：空间系统 (1-2 周)

- [ ] 河岸空间渲染（Canvas 或 CSS）
- [ ] 物品放置/移动交互
- [ ] 空间主题自动计算
- [ ] 查看他人空间页面
- [ ] 背包系统

### Phase 4：社交系统 (1-2 周)

- [ ] 卡皮巴拉串门 Cron + 见闻生成
- [ ] 社交发现页面（推荐河岸）
- [ ] 打招呼 + 留言功能
- [ ] 1v1 消息系统
- [ ] Supabase Realtime 消息推送

### Phase 5：打磨与上线 (1 周)

- [ ] 美术资源替换（当前用 emoji 占位）
- [ ] PWA 配置（可安装到桌面）
- [ ] 性能优化
- [ ] 冷启动内容（系统生成的无主河岸）
- [ ] 部署上线
