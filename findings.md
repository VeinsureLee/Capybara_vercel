# Findings & Decisions

## Requirements

**核心目标：** V1 → V2 升级，从"关键词驱动探索"迁移到"记忆驱动旅行 + 真实地点 + 每日手记 + 记忆共鸣社交"。

### V2 核心功能清单

- 记忆系统：对话 → AI 提取结构化记忆 → shareable/private 分档 → 记忆库 UI
- 多日旅行系统：真实地点库 ~60个 → 意向词匹配 → 1-5天旅行 → home→traveling→resting→home
- 每日手记生成：Webtoon 叙事漫画结构 → 匹配相遇段落 → 社交入口
- 全局记忆匹配：每日配对 → 同地点旅行 → 手记中融入相遇
- 卡皮独立性：婉拒 ~10%、主动起话题、记忆意愿表达
- 休息日生活层：5种动作循环（sleep/swim/idle/eat/gaze）
- 装扮系统：4槽位（head/body/tail/accessory），V2 MVP 内容极简
- 隐私保护：记忆分档 + 脱敏 + 用户可控记忆库

### V2 明确不做

- 商业化付费（V2+ 阶段）
- 共创活动 / Agent 协作（V2+ 阶段）
- AI 生成手记插图（Growth 阶段）
- 卡皮主动串门访问他人河岸（V2+ 阶段）
- 装扮拒绝穿脱（V1 只做情绪反馈）
- 发现页 / 精选列表（永不做）

---

## Research Findings

### 当前代码状态（V1 已实现）

**已实现的 src 文件：**
- API 路由: auth/callback, capybara, chat, explore, visit（5 个 route.ts）
- 页面: chat, explore, home, login, register, layout, page（7 个页面）
- 组件: BottomNav + explore/ 下 7 个动画组件
- Lib: ai/client.ts, ai/prompts.ts, sim/jaccard.ts, sim/persona.ts, supabase/client.ts, supabase/server.ts
- 其他: middleware.ts, types/index.ts

**数据库迁移：**
- `schema.sql` — 核心表（profiles, capybaras, conversations, explorations）
- `002_visiting.sql` — V1 社交表（persona_cards, visits, user_affinity）
- 003 尚未创建 — V2 表待新建

**V2 需要新建的文件：**
- `supabase/migrations/003_v2_structure.sql`
- `src/lib/memory/extract.ts`
- `src/lib/travel/locations.ts`
- `src/lib/travel/matching.ts`
- `src/app/api/travel/route.ts`
- `src/app/api/journal/route.ts`
- `src/app/api/memory/route.ts`
- `src/app/travel/page.tsx`
- `src/app/journal/page.tsx`
- `src/app/memory/page.tsx`

**V2 需要修改的文件：**
- `src/types/index.ts` — 新增 V2 类型
- `src/lib/ai/prompts.ts` — 重写 chat prompt + 新增 memory/journal/travel prompts
- `src/app/api/chat/route.ts` — 集成记忆提取 + V2 状态差异化
- `src/app/chat/page.tsx` — V2 UI 适配
- `src/app/home/page.tsx` — 生活层动作
- `src/components/BottomNav.tsx` — 新增导航项
- `CLAUDE.md` — 反映 V2 架构

### 已存在的 V2 迁移计划

`docs/superpowers/plans/2026-04-15-v2-structure-migration.md` 已包含：
- Task 1: V2 类型定义（详细的 TypeScript 接口）
- Task 2: V2 数据库迁移（完整 SQL）
- 后续 Task 待补充

### V2 核心数据模型

**4 张新表：**
1. `memories` — 结构化记忆（topic, summary, emotion, shareable, sensitive_category）
2. `travel_locations` — 真实地点库（name, region, tags[], description, visual_keywords[]）
3. `travels` — 多日旅行记录（location_id, duration_days, matched_user_id, status）
4. `journals` — 每日手记（travel_id, day_number, narrative, encounter_narrative）

**capybaras 表扩展字段：**
- `equipped_costumes` JSONB — 装扮槽位
- `current_life_action` — 当前生活层动作
- `last_travel_completed_at` — 上次旅行完成时间

### 匹配算法设计

**V2 记忆驱动匹配公式：**
```
memory_match(A, B) = 0.6 · topic_sim(A, B)
                   + 0.25 · emotion_sim(A, B)
                   + 0.15 · intent_sim(A, B)
```

- MVP 阶段 topic_sim 用 Jaccard 相似度（后续可升级 pgvector 余弦）
- 每日全局贪心配对，配对成功的双方去同一地点
- 冷启动策略：不伪造匹配，"空手而归"是正常结果

### AI 调用策略

- 三级降级链：DeepSeek → Claude → OpenAI → 本地模板兜底
- 单次 AI 调用超时 30s（Vercel Function 最大 60s）
- 记忆提取内嵌在 chat 响应中，一次推理同时产出回复和记忆

### Serverless 约束

- Vercel Function 最大 60s 执行时间
- Hobby plan Cron 每日只能 1 次 → 需 Pro ($20/月)
- 惰性完成模式：用户打开页面时检查是否完成，不依赖后台任务
- 无 WebSocket 常驻连接，Realtime 由 Supabase 提供

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| V2 状态机独立于 V1 | V1 `exploring/visiting` 保留兼容，V2 用 `traveling/resting` |
| 记忆提取内嵌 chat API | 减少额外调用，AI 一次推理同时产出回复和记忆分类 |
| MVP 匹配用 Jaccard | 避免 pgvector 部署复杂度，足够验证产品假设 |
| 手记 MVP 纯文字 | AI 生图角色一致性未成熟，先验证叙事质量 |
| 地点库静态预置 | MVP 60 个地点硬编码在 locations.ts 中，后续扩展到数据库 |
| 不做 Cron 自动旅行触发 | 完全由用户/卡皮对话触发旅行，Serverless 友好 |

---

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| (暂无) | |

---

## Resources

### 关键文档
- 产品 V1: `docs/product/卡皮巴拉产品设计文档_v1.md`
- 产品 V2: `docs/product/卡皮巴拉产品设计文档_v2.md`
- 整体架构: `docs/architecture/整体架构.md`
- 数据模型: `docs/architecture/数据模型.md`
- Serverless: `docs/architecture/Serverless架构设计.md`
- 匹配算法: `docs/architecture/卡皮巴拉串门与用户相似度匹配算法提案.md`
- 记忆模块: `docs/modules/记忆模块.md`
- 手记模块: `docs/modules/手记模块.md`
- 卡皮模块: `docs/modules/卡皮巴拉模块.md`
- 对话模块: `docs/modules/对话模块.md`
- 生命周期: `docs/lifecycle/生命周期.md`
- 操作流程: `docs/lifecycle/操作流程.md`
- 测试方案: `docs/testing/测试方案.md`
- 扩展路线: `docs/roadmap/扩展路线图.md`
- 技术债务: `docs/roadmap/技术债务.md`
- 已有迁移计划: `docs/superpowers/plans/2026-04-15-v2-structure-migration.md`

### 技术栈
- Next.js 15 (App Router) + React 19
- Supabase (PostgreSQL + Auth + RLS + Realtime)
- TypeScript strict
- Tailwind CSS 3.4
- AI: DeepSeek / Claude / OpenAI (三级降级)
- 部署: Vercel (hkg1)
