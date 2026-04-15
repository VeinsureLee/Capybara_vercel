# Task Plan: Capybara V2 全量实现计划

## Goal

将 Capybara 从 V1 MVP（关键词驱动探索 + 串门社交）升级至 V2（记忆驱动旅行 + 真实地点 + 每日手记 + 记忆共鸣社交 + 卡皮独立性），完成后端 API、数据库、AI Prompt、前端页面的全链路开发。

## Current Phase

Phase 9 (世界地图与地点可视化)

---

## Phases

### Phase 1: V2 类型定义 + 数据库迁移
> 基础设施层，所有后续工作的前提

- [x] Step 1.1: 在 `src/types/index.ts` 新增 V2 类型（Memory, Travel, TravelLocation, Journal, CostumeSlot, LifeAction, ChatResponseV2）
- [x] Step 1.2: 更新 Capybara 接口，status 字段同时支持 V1 和 V2 状态
- [x] Step 1.3: 创建 `supabase/migrations/003_v2_structure.sql`，包含 5 张核心表（memories, travel_locations, travels, journals, costume_items）+ capybaras 字段扩展 + RLS 策略 + 索引
- [x] Step 1.4: TypeScript 编译检查，确认无类型错误（`npx tsc --noEmit` 零错误通过）
- **Status:** complete
- **依赖:** 无
- **关键文件:**
  - 修改: `src/types/index.ts`
  - 新建: `supabase/migrations/003_v2_structure.sql`
- **参考文档:** `docs/architecture/数据模型.md`, `docs/modules/卡皮巴拉模块.md`

---

### Phase 2: 记忆系统 (Memory Module)
> V2 核心数据资产，驱动匹配和社交

- [x] Step 2.1: 创建 `src/lib/memory/extract.ts` — 记忆提取逻辑（AI 分档 + 敏感检测 + 意愿表达）
- [x] Step 2.2: `memoryClassifyPrompt` 写入 extract.ts（含 shareable/private 分档规则 + sensitive_category）
- [x] Step 2.3: 创建 `src/app/api/memory/route.ts`（GET 列表 + PATCH 切换分档 + DELETE 删除）
- [x] Step 2.4: 修改 `src/app/api/chat/route.ts` 集成 V2 记忆提取 + memoryReaction 自然语言表达
- **Status:** complete
- **依赖:** Phase 1
- **关键文件:**
  - 新建: `src/lib/memory/extract.ts`, `src/app/api/memory/route.ts`
  - 修改: `src/lib/ai/prompts.ts`, `src/app/api/chat/route.ts`
- **参考文档:** `docs/modules/记忆模块.md`, `docs/modules/对话模块.md`

---

### Phase 3: 多日旅行系统 (Travel Module)
> 替代 V1 小时级探索，引入真实地点

- [x] Step 3.1: 创建 `src/lib/travel/locations.ts` — 41 个真实地点 + 意向词→标签映射 + selectLocation + randomTravelDuration
- [x] Step 3.2: 创建 `src/app/api/travel/route.ts` — POST 发起旅行（~10%拒绝+地点选择+状态机） + GET 懒完成检查
- [x] Step 3.3: 在 prompts.ts 新增 `travelStoryPrompt` + `journalPrompt` + `chatSystemPromptV2`
- [x] Step 3.4: V2 状态机 home→traveling→resting→home（惰性完成模式）
- **Status:** complete
- **依赖:** Phase 1
- **关键文件:**
  - 新建: `src/lib/travel/locations.ts`, `src/app/api/travel/route.ts`
  - 修改: `src/lib/ai/prompts.ts`, `src/app/api/capybara/route.ts`
- **参考文档:** `docs/lifecycle/生命周期.md`, `docs/architecture/Serverless架构设计.md`

---

### Phase 4: 手记系统 (Journal Module)
> 每日旅行叙事漫画 — 用户打开 app 最稳定的动机

- [x] Step 4.1: `journalPrompt` 已在 Phase 3 中与 chatSystemPromptV2/travelStoryPrompt 一并创建
- [x] Step 4.2: 创建 `src/app/api/journal/route.ts`（GET 列表 + POST 生成含匹配相遇）
- [x] Step 4.3: 手记数据结构完整（narrative, encounter_narrative, daily_item, day_number）
- **Status:** complete
- **依赖:** Phase 1, Phase 3
- **关键文件:**
  - 新建: `src/app/api/journal/route.ts`
  - 修改: `src/lib/ai/prompts.ts`
- **参考文档:** `docs/modules/手记模块.md`

---

### Phase 5: 记忆驱动匹配 (Memory Matching)
> V2 社交系统的地基 — 全局每日配对

- [x] Step 5.1: 创建 `src/lib/travel/matching.ts`（memoryScore: 0.6·topic + 0.25·emotion + 0.15·intent Jaccard）
- [x] Step 5.2: 全局贪心配对算法 globalMatch（两两计算→降序排列→贪心配对）
- [x] Step 5.3: 冷启动策略内置（users < 2 → 不匹配，分数为 0 也纳入）
- [x] Step 5.4: journal API 已读取 travels.matched_user_id 生成相遇段落
- **Status:** complete
- **依赖:** Phase 2, Phase 3
- **关键文件:**
  - 新建: `src/lib/travel/matching.ts`
  - 修改: `src/app/api/journal/route.ts`（读取匹配结果生成相遇段落）
- **参考文档:** `docs/architecture/卡皮巴拉串门与用户相似度匹配算法提案.md`

---

### Phase 6: Prompt 工程全面升级 (V2 人设 + 卡皮独立性)
> 所有 AI 输出的基调设定

- [x] Step 6.1: `chatSystemPromptV2` 已创建（home/traveling/resting 差异化 + 地点情境 + want_to_travel）
- [x] Step 6.2: ~10% 婉拒已在 travel API 实现；记忆意愿表达在 memoryReactionText 实现
- [ ] Step 6.3: 生活层动作 prompt（sleep/swim/idle/eat/gaze 随机选择）— 留 Phase 7 前端时实现
- [ ] Step 6.4: 敏感话题处理 prompt — 留 Phase 8 打磨阶段
- **Status:** mostly complete (6.3/6.4 deferred)
- **依赖:** Phase 2
- **关键文件:**
  - 修改: `src/lib/ai/prompts.ts`（核心重写）
- **参考文档:** `docs/modules/对话模块.md`, `docs/modules/卡皮巴拉模块.md`, `docs/product/卡皮巴拉产品设计文档_v2.md` §8

---

### Phase 7: 前端页面 (V2 新增 UI)
> 旅行地图、手记浏览、记忆库 — 用户可见的 V2 体验

- [x] Step 7.1: 修改 `/chat` 页面 — V2 旅行提示卡 + memory_reaction 提示 + traveling/resting 状态显示 + 旅行轮询
- [x] Step 7.2: 新建旅行页面 `/travel` — 旅行状态卡（进度条+天数）+ 发起旅行 + 手记内嵌
- [x] Step 7.3: 新建手记页面 `/journal` — 列表+详情视图 + 相遇段落高亮 + 物品展示
- [x] Step 7.4: 新建记忆库页面 `/memory`（"卡皮的小本子"）— 筛选 + 切换分档 + 删除
- [x] Step 7.5: 更新 BottomNav — 5 个标签（河岸/聊天/旅行/手记/记忆）
- [x] Step 7.6: `/home` 新增 traveling/resting 状态文案
- **Status:** complete
- **依赖:** Phase 2, 3, 4, 6
- **关键文件:**
  - 修改: `src/app/chat/page.tsx`, `src/app/home/page.tsx`, `src/components/BottomNav.tsx`
  - 新建: `src/app/travel/page.tsx`, `src/app/journal/page.tsx`, `src/app/memory/page.tsx`
  - 新建组件: `src/components/travel/`, `src/components/journal/`, `src/components/memory/`

---

### Phase 8: 集成、测试与打磨
> 全链路验证 + 质量保障

- [ ] Step 8.1: 全链路冒烟测试（需要 Supabase 环境和 AI API key）
  - 对话 → 记忆提取 → 旅行发起 → 手记生成 → 匹配相遇
  - V2 状态机完整流转（home → traveling → resting → home）
- [x] Step 8.2: V1 → V2 兼容性验证
  - V1 chatSystemPrompt 保留，V1 explore/visit API 未修改
  - V1 类型和接口兼容（status 字段扩展但不删除旧值）
  - V1 数据库表未变更
- [ ] Step 8.3: 输入验证 + 安全（deferred to runtime testing）
  - API 输入 zod schema 验证
  - RLS 策略验证
  - 敏感话题处理验证
- [x] Step 8.4: 更新 CLAUDE.md — 修正迁移文件名 + 新增前端页面文档 + V2 AI 响应格式
- [x] Step 8.5: `npx tsc --noEmit` 零错误 + `npx next build` 成功（20 个页面/路由全部构建）
- **Status:** mostly complete (8.1/8.3 need runtime environment)
- **依赖:** Phase 1-7
- **关键文件:** 全局
- **参考文档:** `docs/testing/测试方案.md`, `docs/engineering/安全设计.md`

---

### Phase 9: 世界地图与地点可视化
> 将旅行页面从简单列表升级为交互式世界地图，展示真实地点、地点详情（含照片）、卡皮旅行状态

- [x] Step 9.1: **数据库扩展** — `travel_locations` 表新增 `latitude`, `longitude`, `image_url`, `gallery_urls` 字段；创建 `004_location_geo.sql` 迁移
- [x] Step 9.2: **地点数据增强** — 为 68 个 MVP 地点补充经纬度坐标 + Unsplash 图片 URL（存入 `locations.ts`）
- [x] Step 9.3: **地点列表 API** — 创建 `GET /api/travel/locations` 返回所有地点（含坐标、图片、区域分组）+ 当前卡皮是否在该地点旅行
- [x] Step 9.4: **世界地图组件** — 安装 `react-simple-maps` + `d3-geo`，创建 `WorldMap.tsx`（SVG 世界地图 + 地点标记点 + 区域颜色 + 缩放 + 卡皮位置动画）
- [x] Step 9.5: **地点详情面板** — 创建 `LocationDetail.tsx`（底部滑出面板：地点照片 + 描述 + 标签 + 卡皮是否在此 + "让卡皮去这里"按钮）
- [x] Step 9.6: **重构旅行页面** — 改造 `/travel` 页面：顶部世界地图 + 下方旅行状态/手记列表；地图上点击地点弹出详情面板；旅行中时地图上显示卡皮位置
- [x] Step 9.7: **旅行中地图动画** — 地图上卡皮图标在当前旅行地点有呼吸动画（ping animation）
- [x] Step 9.8: **文档同步** — 更新 CLAUDE.md 反映地图 UI 变更 + 新文件
- [x] Step 9.9: **TypeScript 编译 + 构建验证** — tsc 零错误 + next build 21 路由全部通过
- **Status:** complete
- **依赖:** Phase 3, Phase 7
- **关键文件:**
  - 新建: `supabase/migrations/004_location_geo.sql`
  - 新建: `src/components/travel/WorldMap.tsx`, `src/components/travel/LocationDetail.tsx`
  - 新建: `src/app/api/travel/locations/route.ts`
  - 修改: `src/lib/travel/locations.ts`, `src/app/travel/page.tsx`
  - 修改: `supabase/migrations/003_v2_structure.sql`（添加字段）
- **参考文档:** `docs/product/卡皮巴拉产品设计文档_v2.md` §5.2（真实地点体系）

---

## 实施优先级与并行策略

```
Phase 1 (类型 + DB)
     │
     ├──→ Phase 2 (记忆系统) ───→ Phase 5 (匹配算法)
     │                                    │
     ├──→ Phase 3 (旅行系统) ──────────────┤
     │         │                           │
     │         └──→ Phase 4 (手记系统) ────┘
     │                                    │
     ├──→ Phase 6 (Prompt 工程) ──────────┤
     │                                    │
     └──→ Phase 7 (前端) ←───── 依赖 2,3,4,6 全部完成
                                          │
                                   Phase 8 (集成测试)
```

**推荐并行方案：**
- Phase 2 + Phase 3 可并行（互不依赖）
- Phase 6 可与 Phase 2/3 并行
- Phase 4 依赖 Phase 3 完成
- Phase 5 依赖 Phase 2 + 3
- Phase 7 在后端 API 基本就绪后开始

---

## Key Questions

1. **MVP 地点数量**：60 个地点的具体清单待确认（文档提到 MVP ~60，最终 350-600）
2. **pgvector 是否启用**：MVP 阶段 topic_sim 用 Jaccard 还是向量余弦？（建议先 Jaccard，后续升级）
3. **AI 图片生成**：手记插图是否在 V2 MVP 中实现？（文档提到角色一致性控制难题，建议 MVP 先纯文字）
4. **Cron 配置**：Vercel Hobby plan 每日只能跑 1 次 Cron，需升级 Pro ($20/月) 支持更频繁调度
5. **首次知情同意**：注册流程中插入隐私说明文案的 UI 位置

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| MVP 匹配用 Jaccard 不用 pgvector | 降低 Supabase 依赖复杂度，MVP 验证不需要向量精度 |
| 保留 V1 所有代码和 API | 向后兼容，V1 用户不受影响 |
| 手记 MVP 先纯文字不生成图片 | AI 生图角色一致性未成熟，先验证文字叙事质量 |
| 惰性完成模式（与 V1 一致） | Serverless 友好，无需后台任务 |
| 记忆提取内嵌在 chat API 中 | 减少额外 API 调用，AI 一次推理同时产出回复和记忆 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (暂无) | - | - |

## Notes

- 已存在一份详细的 V2 结构迁移计划在 `docs/superpowers/plans/2026-04-15-v2-structure-migration.md`，本计划涵盖更大范围
- V1 探索系统 (explore) 暂不清理，V2 旅行系统 (travel) 并行存在
- 所有 prompt 改动应优先在 DeepSeek 上测试（成本最低）
- 商业化（装扮商城付费）在 V2 MVP 中不实现
- 共创活动（画画/合奏等 Agent 协作）在 V2+ 阶段，本计划不涉及
