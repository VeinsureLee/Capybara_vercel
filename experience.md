# Experience Knowledge Base

Lessons learned from debugging. Read this before writing new code to avoid repeating mistakes.

---

## React / Hooks

### [BUG-003] Hooks 必须在 early return 之前声明
- **Context**: `useState(now)` 放在 `if (loading) return <Loading/>` 之后，首次渲染时 React 只看到 14 个 hooks，加载完成后变成 16 个。
- **Principle**: 所有 `useState`、`useEffect`、`useCallback` 必须在组件函数体最顶部，在任何条件 return 之前。React 按调用顺序追踪 hooks。
- **Files**: `src/app/travel/page.tsx`

---

## API Design

### [BUG-004] API 状态查询必须返回完整实体状态
- **Context**: `GET /api/travel` 仅在懒完成瞬间返回 `just_completed: true`，刷新后前端无法知道卡皮在休息。
- **Principle**: 状态查询接口必须始终返回当前实体状态（如 `capybara_status`）。一次性事件标志（`just_completed`）只作补充信息，不能作为前端持久状态的唯一来源。
- **Files**: `src/app/api/travel/route.ts`, `src/app/travel/page.tsx`

---

## Database

### [BUG-005/006] 引用新列时必须处理列不存在的情况
- **Context**: BUG-005: `select('status, rest_until')` 在 `rest_until` 列未创建时查询返回 null。BUG-006: `insert({ visual_highlights })` 在列不存在时返回 PGRST204。
- **Principle**: 1) 部署前用检查清单确认迁移已执行。2) 查询/插入新列时加错误处理和降级逻辑（select 降级去掉新列重试；insert 降级去掉新字段重试）。3) 迁移文件使用 `if not exists` 保证幂等性。
- **Files**: `src/app/api/travel/route.ts`, `src/app/api/journal/route.ts`, `supabase/migrations/005_journal_unique_highlights.sql`

---

## Build / Dependencies

### [BUG-002] dev server 异常优先清除 .next 缓存
- **Context**: `npm run dev` 报 `Module not found: prop-types`、`routes-manifest.json ENOENT`、`Cannot find module ./543.js`，但 `npm run build` 正常通过。
- **Principle**: Next.js dev server 出现诡异模块解析错误时，先 `rm -rf .next` 再重启。dev webpack 的增量编译缓存容易损坏。
- **Files**: `.next/` (cache directory)

---

### [BUG-007] 新建表时必须检查所有需要的 RLS 策略
- **Context**: `travel_locations` 只建了 SELECT 策略，缺少 INSERT 策略。POST /api/travel 写入地点静默失败，location_id 为 null，导致 join 查不到地点数据。
- **Principle**: 1) 新建 RLS 表时，对照代码中所有操作(SELECT/INSERT/UPDATE/DELETE)建立对应策略。2) 外键 join 结果为空时要有降级方案（如本地数据源 fallback）。3) insert 失败要 log 错误，不能静默丢弃。
- **Files**: `supabase/migrations/006_travel_locations_insert_policy.sql`, `src/app/api/travel/[id]/route.ts`

---

## State Machine

### [BUG-005+] 数据不一致时需要自动修复
- **Context**: 卡皮 `status='traveling'` 但 travels 表无对应记录，导致永远卡在旅行状态。
- **Principle**: 状态机涉及多表时，查询方加自愈逻辑：检测到不一致（如 capybara 说在旅行但没有 travel 记录）时自动重置到安全状态（home）。
- **Files**: `src/app/api/travel/route.ts`

---

## Frontend

### [BUG-008] 前端 UI 选择结果必须传递到 API
- **Context**: 用户在地图上点击马达加斯加，`selectedLocation` 状态正确更新，UI 也正确显示了马达加斯加详情，但 `startTravel()` 发送空 body `{}`，后端用关键词随机选了冰岛。
- **Principle**: 前端 UI 的选择结果必须传递到 API 请求中，不能只用于本地展示。用户手动选择应优先于系统自动选择（fallback 关系）。
- **Files**: `src/app/travel/page.tsx`, `src/app/api/travel/route.ts`

---

## Time / Timezone

### [通用] 时间比较使用时间戳而非 Date 对象
- **Context**: `new Date(travel.estimated_return) <= new Date()` 在不同时区可能有偏差。
- **Principle**: 统一使用 `getTime()` 转为毫秒数比较：`returnTime <= nowTime`。服务端存储统一用 UTC（Supabase `timestamptz` 默认 UTC）。
- **Files**: `src/app/api/travel/route.ts`
