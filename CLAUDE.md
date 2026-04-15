# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Capybara (卡皮巴拉养成社交产品) — A pet-rearing AI companion app where users chat with a capybara, send it on multi-day trips to real-world locations, and read webtoon-style daily journals. Social connections emerge organically through memory resonance: shareable memories drive global daily matching, sending paired capybaras to the same destination. V2 in development; V1 MVP preserved.

## V2 Design Philosophy

- **Memory over keywords**: Structured memories (AI-extracted, shareable/private tagged) replace raw keyword aggregation as the core data asset.
- **Real-world grounding**: Capybaras travel to real geographic locations (350-600 globally, MVP ~60), replacing V1's abstract explorations.
- **Organic social**: Global daily matching by memory similarity. No fake spaces — invitation-based cold start; prefer lower match frequency over fabricated encounters.
- **Capybara autonomy**: ~10% refusal rate on travel requests. Life-layer idle actions (sleep/swim/idle/eat/gaze) during rest days.
- **Monetization boundary**: V1 entirely free. V2 introduces paid costume items; social features remain permanently free.

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

- `src/app/api/chat/` — Chat route handler (V1, preserved)
- `src/app/api/capybara/` — Capybara CRUD (V1, preserved; V2 adds costume fields)
- `src/app/api/explore/` — Exploration generation/query (V1, preserved)
- `src/app/api/visit/` — Visit social endpoint (V1, preserved)
- `src/app/api/travel/` — **V2**: Multi-day travel lifecycle (start/poll/complete)
- `src/app/api/journal/` — **V2**: Daily journal (手记) generation and retrieval
- `src/app/api/memory/` — **V2**: Memory extraction, library CRUD, shareable/private toggling
- `src/lib/ai/client.ts` — Multi-provider AI client with 3-level fallback chain (DeepSeek → Claude → OpenAI → local templates)
- `src/lib/ai/prompts.ts` — All prompt templates (chat/explore/visit/travel/journal). Chat persona is a lazy, monosyllabic capybara animal — not a helpful assistant
- `src/lib/memory/extract.ts` — **V2**: AI-powered structured memory extraction from conversations, shareable/private auto-tagging
- `src/lib/travel/locations.ts` — **V2**: Real-world location catalog (68 MVP locations with lat/lng coordinates + Unsplash images)
- `src/lib/travel/timeConfig.ts` — **V2**: Centralized time config (TESTING_MODE: 5min=1day, toggle for production)
- `src/components/travel/WorldMap.tsx` — **V2**: Interactive SVG world map (react-simple-maps) with location markers
- `src/components/travel/LocationDetail.tsx` — **V2**: Bottom sheet panel with location photos, description, tags, travel button
- `src/lib/travel/matching.ts` — **V2**: Global daily memory-similarity matching, paired destination assignment
- `src/lib/sim/` — Similarity algorithms: Jaccard + weighted Jaccard for user affinity scoring, topic sanitization for privacy (V1, preserved)
- `src/lib/supabase/` — Server (`server.ts`) and browser (`client.ts`) Supabase clients
- `src/middleware.ts` — Auth guard: public routes (`/`, `/login`, `/register`), all others require session
- `src/types/index.ts` — Core TypeScript interfaces (Capybara, Conversation, Memory, Travel, Journal, etc.)
- `src/app/api/travel/locations/` — **V2**: Location list API (all locations with coordinates, images, active status)
- `src/app/travel/page.tsx` — **V2**: World map (react-simple-maps) + location detail panel + travel status + journal view
- `src/app/journal/page.tsx` — **V2**: Journal list + detail view with encounter highlights
- `src/app/memory/page.tsx` — **V2**: Memory library ("卡皮的小本子") with shareable/private toggling
- `src/components/explore/` — 4-stage exploration animation (V1, preserved)
- `supabase/schema.sql` — Core tables + RLS policies
- `supabase/migrations/` — Social feature tables (002), V2 travel/memory/journal tables (003)

### Core Patterns

**Capybara status machine (V2):** `home` → `traveling` (1-5 days) → `resting` (1-2 days) → `home`. During rest, capybara performs life-layer actions: sleep/swim/idle/eat/gaze (`current_life_action` field). V1 status machine (`home` ↔ `exploring` ↔ `visiting`) preserved for backward compatibility.

**Memory system (V2):** Conversations → AI extracts structured memories → each tagged `shareable` or `private` → shareable memories enter the global matching pool. Users can review and toggle privacy in a memory library UI.

**Multi-day travel (V2):** 1-5 day trips to real-world locations. Capybara may refuse (~10% rate, independent will). Travel completion is checked via polling, serverless-friendly like V1. **Testing mode: all travel/rest durations use minutes instead of days (e.g. 1-5 days → 1-5 minutes) to speed up lifecycle validation. Switch back to days for production.**

**Daily journal / 手记 (V2):** Each evening during travel, a webtoon-style narrative comic is generated. If the capybara was matched with another, the encounter is naturally woven into the journal narrative.

**Memory-driven matching (V2):** Global daily batch: compute memory similarity across all users with shareable memories, pair top matches, assign both capybaras to the same travel location.

**Costume system (V2):** 4 slots (head/body/tail/accessory). Dual acquisition track: exploration-earned (V1 items) + V2 shop (paid items). Stored in `capybaras.equipped_costumes` JSONB.

**AI response format:** All AI calls return JSON parsed via regex (`/\{[\s\S]*\}/`). If parsing fails, fallback templates provide hardcoded responses. V1 chat responses: `reply`, `mood`, `keywords[]`, `want_to_explore`. V2 chat responses add: `want_to_travel`, `memory_reaction`, `memory_extract`.

**Lazy completion (V1, preserved):** Explorations complete when frontend polls `GET /api/explore` and `estimated_return <= now`. No background jobs — serverless-friendly.

**Keyword aggregation (V1, preserved):** Last 20 conversations' keywords are recency-weighted (weight = 1 - index * 0.04), top 5 feed into exploration prompts.

**Capybara memory (V1, preserved):** Max 20 items per capybara, deduped, filtered. Surfaces in persona_cards as sanitized `memory_topics`. V2 structured memories supplement but do not replace this.

**RLS everywhere:** All Supabase tables enforce Row Level Security. API routes call `auth.getUser()` server-side; Supabase RLS handles data isolation.

### Social System

**V2 (memory resonance):**
- `memories` — Structured memory records extracted from conversations, each tagged `shareable` or `private`. Shareable memories feed global matching.
- Memory-driven matching replaces V1 visit-based social. Daily global batch pairs users by memory similarity and sends their capybaras to the same location.
- Encounters appear naturally in journal narratives rather than as standalone visit transcripts.
- Privacy: AI auto-tags memories; users can override in memory library. No personal info leaks into matching pool.

**V1 (preserved):**
- `persona_cards` — Deidentified capybara profiles with sanitized topics (sensitive info → abstract categories via regex mapping in `persona.ts`)
- `visits` — Two capybaras meet, AI generates transcript + eval (affinity/tone_match/novelty scores)
- `user_affinity` — User-to-user similarity: `score = 0.5·jaccard(memory) + 0.2·jaccard(traits) + 0.2·weighted_jaccard(tags) - 0.1·diversity_penalty`
- Visit endpoint uses `visitSystemPrompt` — max 6 turns, strict no-privacy-leak rules

### Tailwind Theme

Custom color palettes: `capybara` (brown), `river` (blue), `meadow` (green). Global bg: `from-meadow-50 to-river-50`.

### Database Setup

1. Create Supabase project
2. Run `supabase/schema.sql` (core tables: profiles, capybaras, conversations, explorations)
3. Run `supabase/migrations/002_visiting.sql` (V1 social tables: persona_cards, visits, user_affinity)
4. Run `supabase/migrations/003_v2_structure.sql` (V2 tables: memories, travels, journals, travel_locations, costume_items; V2 columns on capybaras)
5. Profiles auto-created via trigger on auth.users insert
