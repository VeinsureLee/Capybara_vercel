import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { selectLocation, selectNextLocation, randomTravelDuration, LOCATION_DB } from '@/lib/travel/locations'
import { MS_PER_DAY, LOCATION_COOLDOWN_MS, randomRestDays } from '@/lib/travel/timeConfig'
import { aggregateIntents } from '@/lib/travel/intents'
import { calculateStayDuration, calculateFreshness } from '@/lib/travel/freshness'

/**
 * GET /api/travel - 查询当前旅行状态（含段落跳转 + 懒完成）
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
    if (capyErr.message?.includes('rest_until')) {
      const { data: fallback } = await supabase
        .from('capybaras')
        .select('status')
        .eq('owner_id', user.id)
        .single()
      if (fallback && fallback.status !== 'home' && fallback.status !== 'traveling') {
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
    await supabase
      .from('capybaras')
      .update({ status: 'home', rest_until: null })
      .eq('owner_id', user.id)
    return NextResponse.json({ travel: null, just_rested: true, capybara_status: 'home' })
  }

  if (capybaraCheck?.status === 'resting') {
    return NextResponse.json({
      travel: null,
      capybara_status: 'resting',
      rest_until: capybaraCheck.rest_until,
    })
  }

  // 查询当前旅行
  const { data: travel, error: travelErr } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description)')
    .eq('user_id', user.id)
    .eq('status', 'traveling')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!travel) {
    if (capybaraCheck?.status === 'traveling') {
      await supabase
        .from('capybaras')
        .update({ status: 'home', rest_until: null })
        .eq('owner_id', user.id)
      return NextResponse.json({ travel: null, capybara_status: 'home' })
    }
    return NextResponse.json({ travel: null, capybara_status: capybaraCheck?.status ?? 'home' })
  }

  // 查询当前 segment
  const { data: currentSegment } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description)')
    .eq('travel_id', travel.id)
    .eq('segment_order', travel.current_segment_order ?? 1)
    .single()

  // 查询所有 segments
  const { data: allSegments } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description)')
    .eq('travel_id', travel.id)
    .order('segment_order', { ascending: true })

  const nowMs = Date.now()

  // === 整个旅行结束检查 ===
  const returnTime = new Date(travel.estimated_return).getTime()
  if (nowMs >= returnTime) {
    if (currentSegment && !currentSegment.ended_at) {
      await supabase
        .from('travel_segments')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', currentSegment.id)
    }

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
      segments: allSegments ?? [],
      just_completed: true,
      rest_until: restUntil,
    })
  }

  // === 当前 segment 到期 → 跳转下一地点 ===
  if (currentSegment?.ended_at && nowMs >= new Date(currentSegment.ended_at).getTime()) {
    const elapsedMs = nowMs - new Date(travel.started_at).getTime()
    const elapsedDays = elapsedMs / MS_PER_DAY
    const remainingDays = travel.duration_days - elapsedDays

    if (remainingDays >= 0.5) {
      const intents = await aggregateIntents(supabase, user.id)

      // 本次旅行已去过的地点名
      const visitedNames = (allSegments ?? []).map((s: Record<string, unknown>) => {
        const loc = s.travel_locations as { name: string } | null
        return loc?.name
      }).filter(Boolean) as string[]

      // 用户历史访问次数
      const { data: visitRecords } = await supabase
        .from('location_visits')
        .select('visit_count, travel_locations!location_visits_location_id_fkey(name)')
        .eq('user_id', user.id)

      const visitCounts: Record<string, number> = {}
      ;(visitRecords ?? []).forEach((r: Record<string, unknown>) => {
        const loc = r.travel_locations as { name: string } | null
        if (loc) visitCounts[loc.name] = r.visit_count as number
      })

      const currentLocRegion = (currentSegment.travel_locations as { region: string } | null)?.region ?? ''
      const nextLoc = selectNextLocation(currentLocRegion, intents, visitedNames, visitCounts)

      // 确保地点存在于 DB
      let { data: nextLocRow } = await supabase
        .from('travel_locations')
        .select('id')
        .eq('name', nextLoc.name)
        .single()

      if (!nextLocRow) {
        const { data: newLoc } = await supabase
          .from('travel_locations')
          .insert({
            name: nextLoc.name,
            region: nextLoc.region,
            tags: nextLoc.tags,
            description: nextLoc.description,
            visual_keywords: nextLoc.visual_keywords,
          })
          .select('id')
          .single()
        nextLocRow = newLoc
      }

      const nextVisitCount = (visitCounts[nextLoc.name] ?? 0) + 1
      const nextStayDays = Math.min(calculateStayDuration(nextVisitCount), remainingDays)
      const nextSegmentOrder = (travel.current_segment_order ?? 1) + 1

      const segmentStart = new Date().toISOString()
      const segmentEnd = new Date(Date.now() + nextStayDays * MS_PER_DAY).toISOString()

      await supabase.from('travel_segments').insert({
        travel_id: travel.id,
        location_id: nextLocRow?.id,
        segment_order: nextSegmentOrder,
        started_at: segmentStart,
        ended_at: segmentEnd,
        duration_days: nextStayDays,
        visit_count: nextVisitCount,
        freshness_initial: calculateFreshness(nextVisitCount),
      })

      await supabase
        .from('travels')
        .update({ current_segment_order: nextSegmentOrder })
        .eq('id', travel.id)

      await supabase.from('location_visits').upsert(
        {
          user_id: user.id,
          location_id: nextLocRow?.id,
          visit_count: nextVisitCount,
          last_visited_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,location_id' }
      )

      // 重新查询最新状态
      const { data: updatedSegments } = await supabase
        .from('travel_segments')
        .select('*, travel_locations(name, region, description)')
        .eq('travel_id', travel.id)
        .order('segment_order', { ascending: true })

      const { data: journals } = await supabase
        .from('journals')
        .select('*')
        .eq('travel_id', travel.id)
        .order('day_number', { ascending: true })

      return NextResponse.json({
        travel: { ...travel, current_segment_order: nextSegmentOrder },
        segments: updatedSegments ?? [],
        current_segment: updatedSegments?.find((s: Record<string, unknown>) => s.segment_order === nextSegmentOrder),
        journals: journals ?? [],
        just_moved: true,
        moved_to: nextLoc.name,
      })
    }
    // 剩余预算不足 0.5 天 → 让下次 poll 触发整体完成
  }

  // === 正常状态：返回当前信息 ===
  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('travel_id', travel.id)
    .order('day_number', { ascending: true })

  return NextResponse.json({
    travel,
    segments: allSegments ?? [],
    current_segment: currentSegment,
    journals: journals ?? [],
  })
}

/**
 * POST /api/travel - 发起新旅行（多地点版本）
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let requestedLocationName: string | undefined
  try {
    const body = await req.json()
    requestedLocationName = body.location_name
  } catch {
    // body 为空或解析失败
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

  // 2. 聚合意向词（短期+长期）
  const intents = await aggregateIntents(supabase, user.id)

  // 3. 冷却期内去过的地点
  const cutoff = new Date(Date.now() - LOCATION_COOLDOWN_MS).toISOString()
  const { data: recentTravels } = await supabase
    .from('travels')
    .select('story')
    .eq('user_id', user.id)
    .gte('started_at', cutoff)

  // 4. ~10% 概率卡皮拒绝出发
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

  // 5. 查询历史访问次数
  const { data: visitRecords } = await supabase
    .from('location_visits')
    .select('visit_count, travel_locations!location_visits_location_id_fkey(name)')
    .eq('user_id', user.id)

  const visitCounts: Record<string, number> = {}
  ;(visitRecords ?? []).forEach((r: Record<string, unknown>) => {
    const loc = r.travel_locations as { name: string } | null
    if (loc) visitCounts[loc.name] = r.visit_count as number
  })

  // 6. 选出发地点 + 总行程天数
  const excludeNames = (recentTravels ?? []).map((t) => t.story).filter(Boolean) as string[]
  const manualLocation = requestedLocationName
    ? LOCATION_DB.find((loc) => loc.name === requestedLocationName)
    : undefined
  const location = manualLocation ?? selectLocation(intents, excludeNames)
  const totalDurationDays = randomTravelDuration()

  // 7. 计算第一段的停留天数
  const firstVisitCount = (visitCounts[location.name] ?? 0) + 1
  const firstStayDays = Math.min(calculateStayDuration(firstVisitCount), totalDurationDays)

  const totalDurationMs = totalDurationDays * MS_PER_DAY
  const estimatedReturn = new Date(Date.now() + totalDurationMs).toISOString()

  // 8. 确保地点存在于 travel_locations 表
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
      console.error('Insert travel_location error:', locErr.message)
    }
    locRow = newLoc
  }

  // 9. 创建旅行记录
  const { data: travel, error } = await supabase
    .from('travels')
    .insert({
      capybara_id: capybara.id,
      user_id: user.id,
      status: 'traveling',
      location_id: locRow?.id,
      duration_days: totalDurationDays,
      intent_keywords: intents,
      started_at: new Date().toISOString(),
      estimated_return: estimatedReturn,
      current_segment_order: 1,
    })
    .select()
    .single()

  if (error) {
    console.error('Create travel error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 10. 创建第一个 segment
  const firstSegmentEnd = new Date(Date.now() + firstStayDays * MS_PER_DAY).toISOString()
  await supabase.from('travel_segments').insert({
    travel_id: travel.id,
    location_id: locRow?.id,
    segment_order: 1,
    started_at: new Date().toISOString(),
    ended_at: firstSegmentEnd,
    duration_days: firstStayDays,
    visit_count: firstVisitCount,
    freshness_initial: calculateFreshness(firstVisitCount),
  })

  // 11. 更新 location_visits（upsert）
  await supabase.from('location_visits').upsert(
    {
      user_id: user.id,
      location_id: locRow?.id,
      visit_count: firstVisitCount,
      last_visited_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,location_id' }
  )

  // 12. 更新卡皮状态
  await supabase
    .from('capybaras')
    .update({ status: 'traveling' })
    .eq('id', capybara.id)

  return NextResponse.json({
    travel,
    location,
    duration_days: totalDurationDays,
    estimated_return: estimatedReturn,
    first_stay_days: firstStayDays,
    departure_message: `${capybara.name}想去${location.name}看看……明天就出发`,
  })
}
