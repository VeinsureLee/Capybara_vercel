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
│ status       │
│ memory[]     │
│ experience   │
│ level        │
└──┬─────┬─────┘
   │     │
   │1:N  │1:N
   │     │
   ▼     ▼
┌──────────────┐  ┌───────────────┐
│conversations │  │ explorations  │
│              │  │               │
│ id (PK)      │  │ id (PK)       │
│ user_id (FK) │  │ user_id (FK)  │
│ capybara_id  │  │ capybara_id   │
│ role         │  │ status        │
│ content      │  │ type          │
│ mood         │  │ keywords[]    │
│ keywords[]   │  │ story         │
│ created_at   │  │ items_found[] │
└──────────────┘  │ started_at    │
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
```

---

*模块文档 | 源自 05-项目架构与工程实现 §2.2 M7*
