import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/client'
import { journalPrompt } from '@/lib/ai/prompts'
import { MS_PER_DAY } from '@/lib/travel/timeConfig'

/**
 * GET /api/journal - 获取某次旅行的手记列表
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const travelId = req.nextUrl.searchParams.get('travel_id')

  if (travelId) {
    // 指定旅行的手记
    const { data: journals } = await supabase
      .from('journals')
      .select('*')
      .eq('travel_id', travelId)
      .eq('user_id', user.id)
      .order('day_number', { ascending: true })

    return NextResponse.json({ journals: journals ?? [] })
  }

  // 最近的手记（用于首页展示）
  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ journals: journals ?? [] })
}

/**
 * POST /api/journal - 为当前旅行生成今日手记
 * V2.1: 增加 expected_day 校验 + visual_highlights 生成
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 解析请求体（支持 expected_day 参数）
  let expectedDay: number | undefined
  try {
    const body = await req.json()
    expectedDay = body.expected_day
  } catch { /* empty body is ok */ }

  // 1. 获取当前旅行
  const { data: travel } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description, tags)')
    .eq('user_id', user.id)
    .eq('status', 'traveling')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!travel) {
    return NextResponse.json({ error: '当前没有进行中的旅行' }, { status: 400 })
  }

  // 2. 计算今天是第几天
  const startDate = new Date(travel.started_at)
  const now = new Date()
  const dayNumber = Math.min(
    Math.floor((now.getTime() - startDate.getTime()) / MS_PER_DAY) + 1,
    travel.duration_days
  )

  // V2.1: 校验前端传入的 expected_day 是否与后端一致
  if (expectedDay !== undefined && expectedDay !== dayNumber) {
    return NextResponse.json(
      { error: '天数不一致，请刷新页面', code: 'DAY_CONFLICT', server_day: dayNumber },
      { status: 409 }
    )
  }

  // 检查今天是否已生成
  const { data: existing } = await supabase
    .from('journals')
    .select('id')
    .eq('travel_id', travel.id)
    .eq('day_number', dayNumber)
    .single()

  if (existing) {
    return NextResponse.json({ error: '今日手记已生成', journal_id: existing.id }, { status: 409 })
  }

  // 3. 获取卡皮信息
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('name, traits')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) return NextResponse.json({ error: 'No capybara' }, { status: 404 })

  // 4. 获取匹配信息（如果有）
  const hasEncounter = !!travel.matched_user_id
  let encounterTopics: string[] = []
  let encounterScore = 0

  if (hasEncounter && travel.matched_user_id) {
    const { data: matchedMemories } = await supabase
      .from('memories')
      .select('topic')
      .eq('user_id', travel.matched_user_id)
      .eq('shareable', true)
      .limit(5)

    encounterTopics = (matchedMemories ?? []).map((m) => m.topic)
    // 简化：用共振主题数量估算分数
    encounterScore = Math.min(encounterTopics.length * 0.2, 1)
  }

  // 5. 生成手记
  const location = travel.travel_locations as { name: string; region: string; description: string } | null
  const intents = (travel.intent_keywords as string[]) ?? []

  const prompt = journalPrompt({
    capybaraName: capybara.name,
    locationName: location?.name ?? '未知地点',
    locationDescription: location?.description ?? '',
    dayNumber,
    totalDays: travel.duration_days,
    traits: (capybara.traits as string[]) ?? [],
    hasEncounter: hasEncounter && dayNumber >= 2, // 第1天不触发相遇
    encounterTopics,
    encounterScore,
    intents,
  })

  const aiResult = await callAI('你是旅行手记生成器，只输出 JSON。', prompt)

  let narrative = `${capybara.name}在${location?.name ?? '远方'}度过了安静的一天。看了看天，打了个哈欠。`
  let encounterNarrative: string | null = null
  let dailyItem = null
  let visualHighlights = null

  if (aiResult) {
    try {
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        narrative = parsed.narrative ?? narrative
        encounterNarrative = parsed.encounter_narrative ?? null
        dailyItem = parsed.daily_item ?? null
        // V2.1: 解析 visual_highlights
        if (Array.isArray(parsed.visual_highlights)) {
          visualHighlights = parsed.visual_highlights.slice(0, 2) // 最多保留2个
        }
      }
    } catch { /* fallback */ }
  }

  // 6. 保存手记（UNIQUE(travel_id, day_number) 约束提供数据库级防重）
  const baseRow = {
    travel_id: travel.id,
    user_id: user.id,
    day_number: dayNumber,
    location_name: location?.name ?? '未知地点',
    narrative,
    encounter_narrative: encounterNarrative,
    encounter_user_id: hasEncounter ? travel.matched_user_id : null,
    encounter_score: encounterScore > 0 ? encounterScore : null,
    daily_item: dailyItem,
  }

  // 尝试包含 visual_highlights；如果列不存在则降级重试
  let journal, error
  const rowWithHighlights = visualHighlights
    ? { ...baseRow, visual_highlights: visualHighlights }
    : baseRow

  const result = await supabase
    .from('journals')
    .insert(rowWithHighlights)
    .select()
    .single()

  journal = result.data
  error = result.error

  // 如果是 visual_highlights 列不存在（PGRST204），降级不带该字段重试
  if (error?.code === 'PGRST204' && error.message?.includes('visual_highlights')) {
    console.warn('visual_highlights column missing, retrying without it')
    const fallback = await supabase
      .from('journals')
      .insert(baseRow)
      .select()
      .single()
    journal = fallback.data
    error = fallback.error
  }

  if (error) {
    // 如果是唯一约束冲突（并发请求），返回 409
    if (error.code === '23505') {
      return NextResponse.json({ error: '今日手记已生成（并发冲突）' }, { status: 409 })
    }
    console.error('Create journal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 7. 如果有物品，追加到旅行的 items_found
  if (dailyItem) {
    const currentItems = (travel.items_found as unknown[]) ?? []
    await supabase
      .from('travels')
      .update({ items_found: [...currentItems, dailyItem] })
      .eq('id', travel.id)
  }

  return NextResponse.json({ journal })
}
