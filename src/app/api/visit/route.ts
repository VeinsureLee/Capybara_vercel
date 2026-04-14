import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/client'
import { visitSystemPrompt, visitUserPrompt } from '@/lib/ai/prompts'
import {
  scorePair,
  userSim,
  orderUsers,
  sanitizeMemoryTopics,
} from '@/lib/sim/persona'
import type { PersonaCard, Visit, VisitEval } from '@/types'

/**
 * POST /api/visit
 * 触发一次串门。流程：
 *   1. 确认 A 卡皮巴拉在家
 *   2. upsert A 的 persona_card（懒构建）
 *   3. 召回候选 B（P0：owner != A；排除 30 天内已互访；随机/Jaccard 预筛）
 *   4. 精排取 Top-1
 *   5. 调 LLM 跑双角色对话 + 裁判 JSON
 *   6. 写 visits + upsert user_affinity
 *
 * 约束：
 *   - A 的 status 全程先切到 visiting，结束后回 home
 *   - 裁判标记 contains_private=true 时丢弃 transcript
 */
export async function POST(_req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. A 的卡皮巴拉 + 确认在家
  const { data: capA } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!capA) {
    return NextResponse.json({ error: 'No capybara' }, { status: 404 })
  }
  if (capA.status !== 'home') {
    return NextResponse.json(
      { error: '卡皮巴拉正在外面，没法去串门哦' },
      { status: 400 }
    )
  }

  // 2. 构建/更新 A 的 persona_card
  const aCard = await upsertPersonaCard(supabase, capA.id, user.id)
  if (!aCard) {
    return NextResponse.json(
      { error: 'persona_card 构建失败' },
      { status: 500 }
    )
  }

  // 3. 候选召回（P0：不走 pgvector，直接拉 <=200 张最近更新的名片）
  const { data: candidates } = await supabase
    .from('persona_cards')
    .select('*')
    .neq('owner_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json(
      { error: '暂时没有可以串门的小伙伴~' },
      { status: 404 }
    )
  }

  // 排除 30 天内已经互访过的对
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: recentVisits } = await supabase
    .from('visits')
    .select('a_capybara,b_capybara,created_at')
    .or(`a_owner.eq.${user.id},b_owner.eq.${user.id}`)
    .gte('created_at', cutoff)

  const blocked = new Set<string>()
  ;(recentVisits ?? []).forEach((v) => {
    blocked.add(v.a_capybara)
    blocked.add(v.b_capybara)
  })
  blocked.delete(aCard.capybara_id)

  const eligible = (candidates as PersonaCard[]).filter(
    (c) => !blocked.has(c.capybara_id)
  )
  if (eligible.length === 0) {
    return NextResponse.json(
      { error: '最近已经串过门啦，先歇一歇吧~' },
      { status: 429 }
    )
  }

  // 4. 精排
  const ranked = eligible
    .map((c) => ({ card: c, ...scorePair(aCard, c) }))
    .sort((x, y) => y.score - x.score)

  const picked = ranked[0]
  const bCard = picked.card

  // 标记 A 为 visiting
  await supabase
    .from('capybaras')
    .update({ status: 'visiting' })
    .eq('id', capA.id)

  // 5. LLM 双角色扮演
  const system = visitSystemPrompt(
    {
      name: aCard.name,
      traits: aCard.traits,
      mood: aCard.mood,
      level: aCard.level,
      memory_topics: aCard.memory_topics,
      recent_tags: aCard.recent_tags,
    },
    {
      name: bCard.name,
      traits: bCard.traits,
      mood: bCard.mood,
      level: bCard.level,
      memory_topics: bCard.memory_topics,
      recent_tags: bCard.recent_tags,
    }
  )

  const raw = await callAI(system, visitUserPrompt())

  type Parsed = { transcript: Visit['transcript']; eval: VisitEval }
  let parsed: Parsed | null = null
  if (raw) {
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = m ? (JSON.parse(m[0]) as Parsed) : null
    } catch {
      parsed = null
    }
  }

  // 隐私命中 → 丢弃 transcript
  const containsPrivate = parsed?.eval?.contains_private === true
  const transcript = containsPrivate ? [] : parsed?.transcript ?? []
  const evalBlock = parsed?.eval ?? null

  const affinity = evalBlock?.affinity ?? 0
  const toneMatch = evalBlock?.tone_match ?? 0
  const finalUserSim = userSim(picked.score, affinity, toneMatch)

  // 6. 写 visits
  const { data: visitRow, error: visitErr } = await supabase
    .from('visits')
    .insert({
      a_capybara: aCard.capybara_id,
      b_capybara: bCard.capybara_id,
      a_owner: aCard.owner_id,
      b_owner: bCard.owner_id,
      score: Number(picked.score.toFixed(3)),
      transcript,
      eval: evalBlock,
      status: containsPrivate ? 'discarded' : 'completed',
    })
    .select()
    .single()

  // upsert user_affinity
  if (!containsPrivate) {
    const [ulow, uhigh] = orderUsers(aCard.owner_id, bCard.owner_id)
    await supabase.from('user_affinity').upsert(
      {
        user_low: ulow,
        user_high: uhigh,
        user_sim: Number(finalUserSim.toFixed(3)),
        affinity: Number(affinity.toFixed(3)),
        shared_topics: evalBlock?.shared_topics ?? [],
        last_visit_at: new Date().toISOString(),
      },
      { onConflict: 'user_low,user_high' }
    )
  }

  // 还家
  await supabase.from('capybaras').update({ status: 'home' }).eq('id', capA.id)

  if (visitErr) {
    console.error('[visit] insert error:', visitErr)
    return NextResponse.json({ error: visitErr.message }, { status: 500 })
  }

  return NextResponse.json({
    visit: visitRow,
    user_sim: finalUserSim,
    score_breakdown: {
      sim_vec: picked.sim_vec,
      sim_trait: picked.sim_trait,
      sim_tag: picked.sim_tag,
      diversity_penalty: picked.diversity_penalty,
      score: picked.score,
    },
    summary: evalBlock?.summary_for_A ?? null,
  })
}

/**
 * GET /api/visit
 * 返回当前用户参与过的最近若干次串门记录与好友亲和度榜。
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: visits }, { data: affinity }] = await Promise.all([
    supabase
      .from('visits')
      .select('*')
      .or(`a_owner.eq.${user.id},b_owner.eq.${user.id}`)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('user_affinity')
      .select('*')
      .or(`user_low.eq.${user.id},user_high.eq.${user.id}`)
      .order('user_sim', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    visits: visits ?? [],
    affinity: affinity ?? [],
  })
}

// ------------------------------------------------
// helpers
// ------------------------------------------------

type Supa = Awaited<ReturnType<typeof createServerSupabase>>

/** 拉 capybara + 最近 explorations，构建 / 更新 persona_card */
async function upsertPersonaCard(
  supabase: Supa,
  capybaraId: string,
  ownerId: string
): Promise<PersonaCard | null> {
  const { data: cap } = await supabase
    .from('capybaras')
    .select('id, owner_id, name, traits, mood, level, memory')
    .eq('id', capybaraId)
    .single()

  if (!cap) return null

  const { data: recentExp } = await supabase
    .from('explorations')
    .select('trigger_keywords')
    .eq('user_id', ownerId)
    .order('started_at', { ascending: false })
    .limit(10)

  const recent_tags = Array.from(
    new Set(
      (recentExp ?? [])
        .flatMap((e) => (e.trigger_keywords as string[] | null) ?? [])
        .filter(Boolean)
    )
  ).slice(0, 20)

  const memory_topics = sanitizeMemoryTopics(
    ((cap.memory as string[] | null) ?? []).slice(-30)
  )

  const row = {
    capybara_id: cap.id,
    owner_id: cap.owner_id,
    name: cap.name,
    traits: (cap.traits as string[] | null) ?? [],
    mood: cap.mood ?? null,
    level: cap.level ?? 1,
    memory_topics,
    recent_tags,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('persona_cards')
    .upsert(row, { onConflict: 'capybara_id' })
    .select()
    .single()

  if (error) {
    console.error('[persona_cards] upsert error:', error)
    return null
  }
  return data as PersonaCard
}
