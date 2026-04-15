import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/travel/history?page=1&limit=10
 * 分页查询历史旅行记录（含摘要信息）
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10)))
  const offset = (page - 1) * limit

  // 查询总数
  const { count } = await supabase
    .from('travels')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const total = count ?? 0

  // 查询当前页数据（含地点信息）
  const { data: travels } = await supabase
    .from('travels')
    .select('id, location_id, duration_days, started_at, completed_at, items_found, travel_locations(name, region, description)')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // 为每条旅行查询手记数
  const travelSummaries = await Promise.all(
    (travels ?? []).map(async (t) => {
      const { count: journalCount } = await supabase
        .from('journals')
        .select('id', { count: 'exact', head: true })
        .eq('travel_id', t.id)

      const itemsFound = (t.items_found as unknown[]) ?? []
      const loc = t.travel_locations as unknown as { name: string; region: string } | null

      return {
        id: t.id,
        location_name: loc?.name ?? '未知地点',
        region: loc?.region ?? '',
        duration_days: t.duration_days,
        started_at: t.started_at,
        completed_at: t.completed_at,
        journal_count: journalCount ?? 0,
        item_count: itemsFound.length,
      }
    })
  )

  return NextResponse.json({
    travels: travelSummaries,
    total,
    page,
    has_more: offset + limit < total,
  })
}
