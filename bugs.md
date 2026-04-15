# Bug Tracker

| ID | Status | Description | Reported | Root Cause | Fix | Lesson |
|----|--------|-------------|----------|------------|-----|--------|
| BUG-001 | resolved | react-simple-maps 无类型声明导致 TS7016 | 2026-04-15 | 第三方库无 @types 包 | 创建 src/types/react-simple-maps.d.ts | 引入无类型的 npm 包时，立即创建 .d.ts 声明文件 |
| BUG-002 | resolved | dev server 报 Module not found: prop-types | 2026-04-15 | .next 缓存损坏 + dev webpack 与 build 解析路径不同 | 删除 .next 目录重启 dev server | dev server 异常时优先清除 .next 缓存 |
| BUG-003 | resolved | React Hooks 顺序错误 (TravelPage) | 2026-04-15 | useState/useEffect 放在 early return 之后 | 将所有 hooks 移到组件顶部，early return 之前 | Hooks 必须在所有条件分支和 early return 之前声明 |
| BUG-004 | resolved | 旅行结束后仍显示"旅行中"而非"休息中" | 2026-04-15 | API 仅在懒完成瞬间返回 just_completed，刷新后丢失休息状态 | API 始终返回 capybara_status 字段；前端据此同步状态 | API 状态查询必须始终返回完整实体状态，不依赖一次性事件标志 |
| BUG-005 | resolved | capybara 卡在 traveling 状态不动 | 2026-04-15 | Supabase 缺少 rest_until 列，select('status, rest_until') 查询失败返回 null | 提示用户运行迁移 SQL；代码加容错降级查询 | 查询包含新列时必须处理列不存在的情况；迁移 SQL 必须在部署前确认已执行 |
| BUG-006 | resolved | 手记生成 500: visual_highlights column not found | 2026-04-15 | migration 005 未在远端 Supabase 执行，journals 表缺少 visual_highlights 列 | journal route 先尝试含 visual_highlights 的 insert，PGRST204 时降级不带该字段重试 | 新增数据库列的代码必须兼容列尚未存在的情况；insert 新列失败时降级重试，与 BUG-005 同类 |
| BUG-007 | resolved | 旅行详情页显示"未知地点"，无图片 | 2026-04-15 | travel_locations 表只有 SELECT RLS 策略无 INSERT 策略，POST /api/travel 写入地点被 RLS 拒绝，location_id 为 null | 1) 添加 INSERT RLS 策略(migration 006) 2) /api/travel/[id] 从本地 LOCATION_DB 降级获取地点+图片 3) 详情页用 API 返回的 location_image | 新建表时必须同时检查所有需要的 RLS 策略(SELECT/INSERT/UPDATE/DELETE)；join 为空时要有本地数据源降级 |
| BUG-008 | resolved | 点击马达加斯加但卡皮去了冰岛（地图选点无效） | 2026-04-15 | startTravel() 发送空 body {}，后端未收到用户选的地点，用关键词随机选了其他地点 | 前端 body 传 location_name；后端解析并优先使用用户手选地点，fallback 到关键词选择 | 前端 UI 选择结果必须传递到 API，不能只用于展示；用户手动选择优先于系统自动选择 |
