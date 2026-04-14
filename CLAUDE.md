# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Capybara (卡皮巴拉养成社交产品) — A pet-rearing AI companion app where users chat with a capybara, direct its explorations, and collect items. Features social connections between capybaras via similarity matching. MVP stage.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:3000)
npm run build     # Production build
npm run start     # Run production server
npm run lint      # ESLint
```

No test runner is configured yet. Comprehensive design docs live in `docs/`.

## Environment Variables

Required in `.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon key
```

AI providers (at least one recommended, tried in order):
```
DEEPSEEK_API_KEY=   # Primary: deepseek-chat
CLAUDE_API_KEY=     # Fallback: claude-haiku-4-5-20251001
OPENAI_API_KEY=     # Fallback: gpt-4o-mini
```

If all AI keys missing or all providers fail, local template fallbacks kick in automatically.

## Architecture

**Stack:** Next.js 15 (App Router) + React 19 + Supabase (PostgreSQL + Auth + RLS) + Tailwind CSS 3.4. Deployed on Vercel (serverless).

**Path alias:** `@/*` → `./src/*`

### Key Directories

- `src/app/api/` — Route handlers: `/chat`, `/explore`, `/capybara`, `/visit`
- `src/lib/ai/client.ts` — Multi-provider AI client with 3-level fallback chain (DeepSeek → Claude → OpenAI → local templates)
- `src/lib/ai/prompts.ts` — All prompt templates (chat/explore/visit). Chat persona is a lazy, monosyllabic capybara animal — not a helpful assistant
- `src/lib/sim/` — Similarity algorithms: Jaccard + weighted Jaccard for user affinity scoring, topic sanitization for privacy
- `src/lib/supabase/` — Server (`server.ts`) and browser (`client.ts`) Supabase clients
- `src/middleware.ts` — Auth guard: public routes (`/`, `/login`, `/register`), all others require session
- `src/types/index.ts` — Core TypeScript interfaces (Capybara, Conversation, Exploration, Visit, etc.)
- `src/components/explore/` — 4-stage exploration animation (Departure → Journey → Discovery → Return)
- `supabase/schema.sql` — Core tables + RLS policies
- `supabase/migrations/` — Social feature tables (persona_cards, visits, user_affinity)

### Core Patterns

**Capybara status machine:** `home` ↔ `exploring` ↔ `visiting`. Status determines chat persona behavior and available actions.

**AI response format:** All AI calls return JSON parsed via regex (`/\{[\s\S]*\}/`). If parsing fails, fallback templates provide hardcoded responses. Chat responses include: `reply`, `mood`, `keywords[]`, `want_to_explore`.

**Lazy completion:** Explorations complete when frontend polls `GET /api/explore` and `estimated_return <= now`. No background jobs — serverless-friendly.

**Keyword aggregation:** Last 20 conversations' keywords are recency-weighted (weight = 1 - index * 0.04), top 5 feed into exploration prompts.

**Capybara memory:** Max 20 items per capybara, deduped, filtered (excludes generic terms like 散步/好奇). Surfaces in persona_cards as sanitized `memory_topics`.

**RLS everywhere:** All Supabase tables enforce Row Level Security. API routes call `auth.getUser()` server-side; Supabase RLS handles data isolation.

### Social System (P0, partially implemented)

- `persona_cards` — Deidentified capybara profiles with sanitized topics (sensitive info → abstract categories via regex mapping in `persona.ts`)
- `visits` — Two capybaras meet, AI generates transcript + eval (affinity/tone_match/novelty scores)
- `user_affinity` — User-to-user similarity: `score = 0.5·jaccard(memory) + 0.2·jaccard(traits) + 0.2·weighted_jaccard(tags) - 0.1·diversity_penalty`
- Visit endpoint uses `visitSystemPrompt` — max 6 turns, strict no-privacy-leak rules

### Tailwind Theme

Custom color palettes: `capybara` (brown), `river` (blue), `meadow` (green). Global bg: `from-meadow-50 to-river-50`.

### Database Setup

1. Create Supabase project
2. Run `supabase/schema.sql` (core tables: profiles, capybaras, conversations, explorations)
3. Run `supabase/migrations/002_visiting.sql` (social tables)
4. Profiles auto-created via trigger on auth.users insert
