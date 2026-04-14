# 部署与 CI/CD

> Vercel 部署架构、分支策略、CI 流水线。

---

## 11.1 Vercel 部署架构

```
GitHub Push → Vercel Build → Deploy

Build 过程：
  1. npm install
  2. next build (SSG + SSR)
  3. 部署 Serverless Functions (/api/*)
  4. 部署 Edge Middleware
  5. CDN 分发静态资源

环境变量（Vercel Dashboard 配置）：
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  DEEPSEEK_API_KEY
  CLAUDE_API_KEY
  OPENAI_API_KEY
```

---

## 11.2 分支策略（建议）

```
main          ← 生产环境，Vercel 自动部署
  └── dev     ← 开发环境，Vercel Preview 部署
       └── feature/*  ← 功能分支
```

---

## 11.3 CI 流水线（建议添加）

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
```
