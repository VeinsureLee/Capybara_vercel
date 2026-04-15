# M6: AI 客户端模块 (`ai-client`)

> 封装多 AI 提供商调用，实现三级降级链路和本地模板兜底，确保系统在任何情况下都能产出合理响应。

---

## 模块概览

| 属性 | 说明 |
|------|------|
| 职责 | 多模型调用、降级处理、响应解析、模板兜底；V2 新增：记忆提取、旅行叙事生成、手记生成、状态感知对话 |
| 入口 | `src/lib/ai/client.ts` |
| 依赖 | 外部 HTTP API（DeepSeek, Anthropic, OpenAI） |
| 超时 | 25s per provider |

---

## 降级链路

```
callAI(system, prompt)
  │
  ├─ [有 DEEPSEEK_API_KEY?] → DeepSeek API
  │    ├─ 成功 → return response
  │    └─ 失败 → continue
  │
  ├─ [有 CLAUDE_API_KEY?] → Claude API
  │    ├─ 成功 → return response
  │    └─ 失败 → continue
  │
  ├─ [有 OPENAI_API_KEY?] → OpenAI API
  │    ├─ 成功 → return response
  │    └─ 失败 → continue
  │
  └─ return null → 调用方使用 fallback 模板
```

降级策略说明：
- 按配置的 API Key 顺序尝试：DeepSeek → Claude → OpenAI
- 每个 provider 有独立的 25 秒超时
- 最差情况（三个 provider 都超时）需要 75 秒
- 所有 provider 失败时返回 null，由调用方使用本地兜底模板

---

## 本地兜底模板

当所有 AI 服务不可用时，使用基于关键词匹配的本地模板生成响应。

### 对话兜底

```typescript
fallbackChat(message):
  "累|辛苦|疲"  → 治愈回复 + mood: "concerned"
  "开心|高兴|棒" → 开心回复 + mood: "happy"
  "探索|出发|走" → 探索暗示 + want_to_explore: true
  default        → 随机日常回复 + mood: "calm"
```

### 探索兜底

```typescript
fallbackExploration(keywords):
  地点池: 花田草地/竹林小径/溪边石滩/旧仓库/月光湖畔
  物品池: 每地点 6-8 个物品，混合稀有度
  随机选择 → 格式化为标准响应
```

---

## V2 新增 Prompt 类型

V2 引入四种新的 Prompt 模板，覆盖记忆提取、多日旅行、每日手记和状态感知对话场景。

### memoryExtractionPrompt — 记忆提取

从对话内容中提取结构化记忆条目，供后续社交匹配和手记生成使用。

```typescript
memoryExtractionPrompt(conversation):
  输入: 最近一轮对话内容（用户消息 + 卡皮巴拉回复）
  输出 JSON:
    {
      memories: [
        {
          topic: string,       // 记忆主题（如 "喜欢雨天散步"）
          emotion: string,     // 情绪标签（happy/sad/nostalgic/curious/calm）
          intent: string,      // 意图分类（share/vent/ask/play）
          shareable: boolean   // 是否可公开（涉及隐私则 false）
        }
      ]
    }
  规则:
    - 每轮对话提取 0-3 条记忆
    - 涉及真实姓名/地址/电话等隐私信息自动标记 shareable: false
    - 通用闲聊（如 "你好"、"嗯"）不产生记忆
```

### travelPrompt — 旅行叙事生成

为卡皮巴拉的多日旅行生成目的地叙事内容。

```typescript
travelPrompt(capybara, location, duration_days, memories):
  输入:
    - capybara: 卡皮巴拉信息（名字、性格、记忆）
    - location: 目的地（名称、国家、地区、气候、描述）
    - duration_days: 旅行天数（1-5）
    - memories: 卡皮巴拉近期记忆（影响旅行偏好）
  输出 JSON:
    {
      destination_name: string,
      narrative: string,          // 出发时的旅行概述
      daily_highlights: string[], // 每日亮点描述（长度 = duration_days）
      souvenirs: [                // 旅途纪念品（1-3 件）
        { name: string, rarity: string, description: string }
      ]
    }
  规则:
    - 目的地为真实世界地点（城市、自然景观等）
    - 叙事风格保持卡皮巴拉慵懒语气
    - daily_highlights 每条 50-100 字
```

### journalPrompt — 每日手记生成

每天傍晚生成 Webtoon 风格的叙事手记，如有社交匹配则包含偶遇片段。

```typescript
journalPrompt(capybara, travel, day_number, encounter?):
  输入:
    - capybara: 卡皮巴拉信息
    - travel: 当前旅行信息（目的地、进度）
    - day_number: 当前旅行第几天
    - encounter?: 可选，匹配用户的卡皮巴拉信息
  输出 JSON:
    {
      content: {
        panels: [                 // Webtoon 面板序列
          {
            type: "narration" | "dialogue" | "scene",
            text: string,
            mood: string,
            visual_hint: string   // 场景描述提示（供前端渲染参考）
          }
        ]
      },
      encounter_segment?: {       // 仅当 encounter 存在时
        panels: [
          { type: string, text: string, mood: string, visual_hint: string }
        ],
        affinity_hint: string     // 两只卡皮巴拉互动氛围（friendly/shy/playful）
      }
    }
  规则:
    - 每日手记 4-8 个面板
    - 偶遇片段 2-4 个面板
    - 叙事口吻为第三人称旁白 + 卡皮巴拉独白混合
    - 不泄露用户真实身份信息
```

### v2ChatPrompt — V2 状态感知对话

根据卡皮巴拉当前状态（home/traveling/resting）切换对话人设。

```typescript
v2ChatPrompt(capybara, status, context):
  状态差异:
    home（在家）:
      - 人设：慵懒、单字回复、偶尔发呆
      - 与 V1 chatSystemPrompt 一致
      - 可触发旅行意愿（want_to_travel: true）

    traveling（旅途中）:
      - 人设：远程消息风格，回复简短带旅行见闻
      - 偶尔不回复（模拟信号不好）
      - 会提及当前目的地的场景
      - 示例风格："刚看到一只海鸥...信号不太好...回来再聊"

    resting（休息中）:
      - 人设：困倦、刚旅行回来、话少但愿意分享
      - 偶尔提及旅途回忆
      - 示例风格："嗯...刚回来...好累...那边的日落很好看..."

  输出 JSON:
    {
      reply: string,
      mood: string,
      keywords: string[],
      want_to_travel?: boolean   // 仅 home 状态可能为 true
    }
```

---

## V2 本地兜底模板

V2 新增 Prompt 类型对应的兜底模板，在 AI 服务不可用时提供基础功能。

### 记忆提取兜底

```typescript
fallbackMemoryExtraction(conversation):
  从对话内容中提取关键词作为 topic
  默认 emotion: "calm"
  默认 intent: "share"
  默认 shareable: true
  隐私关键词匹配（手机号/地址/身份证等）→ shareable: false
  返回 memories[]（0-2 条）
```

### 旅行生成兜底

```typescript
fallbackTravel(keywords):
  预设地点池:
    - 镰仓海边小镇 (日本, 温带海洋, 1-3天)
    - 清迈古城 (泰国, 热带, 2-4天)
    - 冰岛蓝湖温泉 (冰岛, 寒带, 3-5天)
    - 瑞士少女峰 (瑞士, 高山, 2-4天)
    - 济州岛橘子园 (韩国, 温带, 1-3天)
  随机选择地点 → 生成模板化叙事
  daily_highlights 使用通用模板填充
  souvenirs 从地点关联物品池中随机选取
```

### 手记生成兜底

```typescript
fallbackJournal(capybara, travel, day_number):
  模板面板序列:
    - panel 1: 场景描写（"第{day}天，{name}在{location}醒来..."）
    - panel 2: 日常活动（从模板池随机选取）
    - panel 3: 感受独白（"今天也是悠闲的一天呢..."）
    - panel 4: 傍晚总结（"夕阳把{location}染成了橘色..."）
  encounter_segment: 不生成（需 AI 才能个性化）
```

---

## 延迟优化

```
当前：串行调用降级链，最差 75s（3×25s 超时）
优化方案：
  1. 降低单次超时至 15s
  2. 缓存最近 AI 配置状态，跳过已知不可用的 provider
  3. 未来考虑 streaming response（SSE）减少感知延迟
```

---

## 环境变量

| 变量名 | 必需 | 暴露给前端 | 说明 |
|-------|------|----------|------|
| `DEEPSEEK_API_KEY` | 否 | 否 | DeepSeek AI（推荐） |
| `CLAUDE_API_KEY` | 否 | 否 | Claude AI |
| `OPENAI_API_KEY` | 否 | 否 | OpenAI |

> 至少配置一个 AI API Key 才能获得 AI 回复。无 Key 时使用本地模板兜底。

---

## 相关文件

```
src/
└── lib/ai/
    ├── client.ts               # 多 AI 提供商客户端（降级链路）
    ├── prompts.ts              # 提示词模板（对话/探索/串门 — V1）
    ├── memory.ts               # V2: 记忆提取 prompt + 兜底逻辑
    └── journal.ts              # V2: 手记生成 prompt + 兜底逻辑
```

---

*模块文档 | 源自 05-项目架构与工程实现 §2.2 M6*
