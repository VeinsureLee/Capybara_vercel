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
    const { data: journals } = await supabase
      .from('journals')
      .select('*')
      .eq('travel_id', travelId)
      .eq('user_id', user.id)
      .order('day_number', { ascending: true })

    return NextResponse.json({ journals: journals ?? [] })
  }

  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ journals: journals ?? [] })
}

/**
 * POST /api/journal - 为当前旅行生成今日手记（多地点感知）
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // 2. 获取当前 segment（如果有）
  const segmentOrder = travel.current_segment_order ?? 1
  const { data: currentSegment } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description, tags)')
    .eq('travel_id', travel.id)
    .eq('segment_order', segmentOrder)
    .single()

  // 使用 segment 的地点信息（如果存在），否则 fallback 到 travel 的地点
  const segmentLocation = currentSegment?.travel_locations as { name: string; region: string; description: string } | null
  const travelLocation = travel.travel_locations as { name: string; region: string; description: string } | null
  const location = segmentLocation ?? travelLocation

  // 3. 计算今天是第几天（相对于整个旅行）
  const startDate = new Date(travel.started_at)
  const now = new Date()
  const dayNumber = Math.min(
    Math.floor((now.getTime() - startDate.getTime()) / MS_PER_DAY) + 1,
    travel.duration_days
  )

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

  // 4. 获取卡皮信息
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('name, traits')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) return NextResponse.json({ error: 'No capybara' }, { status: 404 })

  // 5. 匹配信息
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
    encounterScore = Math.min(encounterTopics.length * 0.2, 1)
  }

  // 6. 判断段落过渡状态
  let isLastDayOfSegment = false
  if (currentSegment?.ended_at) {
    const segEndMs = new Date(currentSegment.ended_at).getTime()
    const nextDayMs = new Date(travel.started_at).getTime() + dayNumber * MS_PER_DAY
    isLastDayOfSegment = nextDayMs >= segEndMs
  }

  let isFirstDayOfSegment = false
  if (currentSegment && segmentOrder > 1) {
    const segStartMs = new Date(currentSegment.started_at).getTime()
    const thisDayStartMs = new Date(travel.started_at).getTime() + (dayNumber - 1) * MS_PER_DAY
    isFirstDayOfSegment = thisDayStartMs >= segStartMs &&
      thisDayStartMs < segStartMs + MS_PER_DAY
  }

  // 7. 生成手记
  const intents = (travel.intent_keywords as string[]) ?? []

  const segmentDayNumber = currentSegment
    ? Math.max(1, Math.floor((now.getTime() - new Date(currentSegment.started_at).getTime()) / MS_PER_DAY) + 1)
    : dayNumber
  const segmentTotalDays = currentSegment?.duration_days ?? travel.duration_days

  const prompt = journalPrompt({
    capybaraName: capybara.name,
    locationName: location?.name ?? '未知地点',
    locationDescription: location?.description ?? '',
    dayNumber: segmentDayNumber,
    totalDays: Math.ceil(segmentTotalDays),
    traits: (capybara.traits as string[]) ?? [],
    hasEncounter: hasEncounter && dayNumber >= 2,
    encounterTopics,
    encounterScore,
    intents,
    isFirstDayOfSegment,
    isLastDayOfSegment,
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
        if (Array.isArray(parsed.visual_highlights)) {
          visualHighlights = parsed.visual_highlights.slice(0, 2)
        }
      }
    } catch { /* fallback */ }
  }

  // 8. 保存手记
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
    segment_id: currentSegment?.id ?? null,
  }

  const rowWithHighlights = visualHighlights
    ? { ...baseRow, visual_highlights: visualHighlights }
    : baseRow

  let journal, error
  const result = await supabase
    .from('journals')
    .insert(rowWithHighlights)
    .select()
    .single()

  journal = result.data
  error = result.error

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
    if (error.code === '23505') {
      return NextResponse.json({ error: '今日手记已生成（并发冲突）' }, { status: 409 })
    }
    console.error('Create journal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 9. 物品追加
  if (dailyItem) {
    const currentItems = (travel.items_found as unknown[]) ?? []
    await supabase
      .from('travels')
      .update({ items_found: [...currentItems, dailyItem] })
      .eq('id', travel.id)
  }

  return NextResponse.json({ journal })
}
