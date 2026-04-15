import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { selectLocation, randomTravelDuration, LOCATION_DB } from '@/lib/travel/locations'
import { MS_PER_DAY, LOCATION_COOLDOWN_MS, randomRestDays } from '@/lib/travel/timeConfig'

/**
 * GET /api/travel - 查询当前旅行状态（含懒完成）
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 懒检查：休息期是否结束
  const { data: capybaraCheck, error: capyErr } = await supabase
    .from('capybaras')
    .select('status, rest_until')
    .eq('owner_id', user.id)
    .single()

  if (capyErr) {
    console.error('[travel] capybara query error:', capyErr.message, capyErr.code)
    // 如果是因为 rest_until 列不存在，降级查询只取 status
    if (capyErr.message?.includes('rest_until')) {
      const { data: fallback } = await supabase
        .from('capybaras')
        .select('status')
        .eq('owner_id', user.id)
        .single()
      console.log('[travel] fallback capybara status:', fallback?.status)
      // 没有 rest_until 列，无法管理休息期，直接按 status 处理
      if (fallback && fallback.status !== 'home' && fallback.status !== 'traveling') {
        // 状态异常，重置
        await supabase.from('capybaras').update({ status: 'home' }).eq('owner_id', user.id)
        return NextResponse.json({ travel: null, capybara_status: 'home' })
      }
    }
  }

  if (
    capybaraCheck?.status === 'resting' &&
    capybaraCheck.rest_until &&
    new Date(capybaraCheck.rest_until) <= new Date()
  ) {
    // 休息结束 → 回家
    await supabase
      .from('capybaras')
      .update({ status: 'home', rest_until: null })
      .eq('owner_id', user.id)

    return NextResponse.json({ travel: null, just_rested: true, capybara_status: 'home' })
  }

  // 仍在休息中（未到期）
  if (capybaraCheck?.status === 'resting') {
    return NextResponse.json({
      travel: null,
      capybara_status: 'resting',
      rest_until: capybaraCheck.rest_until,
    })
  }

  console.log('[travel] capybara status:', capybaraCheck?.status, 'rest_until:', capybaraCheck?.rest_until)

  // 卡皮状态是 traveling 但可能 travels 表记录已丢失 → 修复为 home
  const { data: travel, error: travelErr } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description)')
    .eq('user_id', user.id)
    .eq('status', 'traveling')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  console.log('[travel] query result:', travel ? `id=${travel.id} est_return=${travel.estimated_return}` : 'null', 'err:', travelErr?.code)

  if (!travel) {
    // 卡皮状态是 traveling 但没有旅行记录 → 数据不一致，修复
    if (capybaraCheck?.status === 'traveling') {
      console.log('[travel] FIX: capybara stuck in traveling without travel record, resetting to home')
      await supabase
        .from('capybaras')
        .update({ status: 'home', rest_until: null })
        .eq('owner_id', user.id)
      return NextResponse.json({ travel: null, capybara_status: 'home' })
    }
    return NextResponse.json({ travel: null, capybara_status: capybaraCheck?.status ?? 'home' })
  }

  // 懒完成：到时间了标记完成 + 卡皮进入休息期
  const returnTime = new Date(travel.estimated_return).getTime()
  const nowTime = Date.now()
  console.log('[travel] lazy check:', {
    estimated_return: travel.estimated_return,
    returnTime,
    nowTime,
    diff_sec: Math.round((returnTime - nowTime) / 1000),
    shouldComplete: nowTime >= returnTime,
  })
  if (returnTime <= nowTime) {
    const restDays = randomRestDays()
    const restUntil = new Date(Date.now() + restDays * MS_PER_DAY).toISOString()

    await supabase
      .from('travels')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', travel.id)

    await supabase
      .from('capybaras')
      .update({
        status: 'resting',
        last_travel_completed_at: new Date().toISOString(),
        rest_until: restUntil,
      })
      .eq('owner_id', user.id)

    return NextResponse.json({
      travel: { ...travel, status: 'completed', completed_at: new Date().toISOString() },
      just_completed: true,
      rest_until: restUntil,
    })
  }

  // 查今日手记
  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('travel_id', travel.id)
    .order('day_number', { ascending: true })

  return NextResponse.json({ travel, journals: journals ?? [] })
}

/**
 * POST /api/travel - 发起新旅行
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 解析请求体，获取用户手动选择的地点（可选）
  let requestedLocationName: string | undefined
  try {
    const body = await req.json()
    requestedLocationName = body.location_name
  } catch {
    // body 为空或解析失败，忽略
  }

  // 1. 确认卡皮在家
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) return NextResponse.json({ error: 'No capybara' }, { status: 404 })
  if (capybara.status !== 'home' && capybara.status !== 'resting') {
    return NextResponse.json({ error: '卡皮巴拉还在外面呢~' }, { status: 400 })
  }

  // 2. 聚合最近意向词（从 conversations）
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('keywords')
    .eq('user_id', user.id)
    .not('keywords', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const keywordWeights: Record<string, number> = {}
  ;(recentConvos || []).forEach((conv, i) => {
    const weight = 1 - i * 0.04
    const kws = conv.keywords as string[]
    kws?.forEach((kw) => {
      keywordWeights[kw] = (keywordWeights[kw] || 0) + weight
    })
  })

  const intents = Object.entries(keywordWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([kw]) => kw)

  // 3. 冷却期内去过的地点
  const cutoff = new Date(Date.now() - LOCATION_COOLDOWN_MS).toISOString()
  const { data: recentTravels } = await supabase
    .from('travels')
    .select('story')
    .eq('user_id', user.id)
    .gte('started_at', cutoff)

  // 4. ~10% 概率卡皮拒绝出发（独立性表现）
  if (Math.random() < 0.1) {
    const refusals = [
      '不想去……今天想泡水',
      '*翻了个身* 累了',
      '嗯…改天吧',
      '*打了个哈欠* 现在不想动',
    ]
    return NextResponse.json({
      refused: true,
      message: refusals[Math.floor(Math.random() * refusals.length)],
    })
  }

  // 5. 选地点 + 天数（优先使用用户手动选择的地点）
  const excludeNames = (recentTravels ?? []).map((t) => t.story).filter(Boolean) as string[]
  const manualLocation = requestedLocationName
    ? LOCATION_DB.find((loc) => loc.name === requestedLocationName)
    : undefined
  const location = manualLocation ?? selectLocation(intents, excludeNames)
  const durationDays = randomTravelDuration()

  // 旅行时间（测试模式：1天=5分钟，生产模式：1天=24小时）
  const durationMs = durationDays * MS_PER_DAY
  const estimatedReturn = new Date(Date.now() + durationMs).toISOString()

  // 6. 插入地点（如果不存在）
  let { data: locRow } = await supabase
    .from('travel_locations')
    .select('id')
    .eq('name', location.name)
    .single()

  if (!locRow) {
    const { data: newLoc, error: locErr } = await supabase
      .from('travel_locations')
      .insert({
        name: location.name,
        region: location.region,
        tags: location.tags,
        description: location.description,
        visual_keywords: location.visual_keywords,
      })
      .select('id')
      .single()
    if (locErr) {
      console.error('Insert travel_location error (RLS?):', locErr.message)
    }
    locRow = newLoc
  }

  // 7. 创建旅行记录
  const { data: travel, error } = await supabase
    .from('travels')
    .insert({
      capybara_id: capybara.id,
      user_id: user.id,
      status: 'traveling',
      location_id: locRow?.id,
      duration_days: durationDays,
      intent_keywords: intents,
      started_at: new Date().toISOString(),
      estimated_return: estimatedReturn,
    })
    .select()
    .single()

  if (error) {
    console.error('Create travel error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 8. 更新卡皮状态
  await supabase
    .from('capybaras')
    .update({ status: 'traveling' })
    .eq('id', capybara.id)

  return NextResponse.json({
    travel,
    location,
    duration_days: durationDays,
    estimated_return: estimatedReturn,
    departure_message: `${capybara.name}想去${location.name}看看……明天就出发`,
  })
}
