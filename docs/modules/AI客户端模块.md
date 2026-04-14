# M6: AI 客户端模块 (`ai-client`)

> 封装多 AI 提供商调用，实现三级降级链路和本地模板兜底，确保系统在任何情况下都能产出合理响应。

---

## 模块概览

| 属性 | 说明 |
|------|------|
| 职责 | 多模型调用、降级处理、响应解析、模板兜底 |
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
    └── prompts.ts              # 提示词模板（对话/探索）
```

---

*模块文档 | 源自 05-项目架构与工程实现 §2.2 M6*
