import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { LOCATION_DB } from '@/lib/travel/locations'

/**
 * GET /api/travel/[id] - 获取单次旅行详情（含手记、物品、分段）
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: travel, error } = await supabase
    .from('travels')
    .select('*, travel_locations(name, region, description, tags, visual_keywords)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !travel) {
    return NextResponse.json({ error: '旅行记录不存在' }, { status: 404 })
  }

  // 查询 segments
  const { data: segments } = await supabase
    .from('travel_segments')
    .select('*, travel_locations(name, region, description)')
    .eq('travel_id', id)
    .order('segment_order', { ascending: true })

  // 从本地地点库补充 image URL
  const locData = travel.travel_locations as { name?: string } | null
  const localLoc = LOCATION_DB.find((l) => l.name === locData?.name)

  if (!travel.travel_locations) {
    const { data: firstJournal } = await supabase
      .from('journals')
      .select('location_name')
      .eq('travel_id', id)
      .limit(1)
      .single()

    const locName = firstJournal?.location_name
    const fallbackLoc = locName && locName !== '未知地点'
      ? LOCATION_DB.find((l) => l.name === locName)
      : null

    if (fallbackLoc) {
      travel.travel_locations = {
        name: fallbackLoc.name,
        region: fallbackLoc.region,
        description: fallbackLoc.description,
        tags: fallbackLoc.tags,
        visual_keywords: fallbackLoc.visual_keywords,
      }
    }
  }

  const matchedLoc = localLoc ?? LOCATION_DB.find(
    (l) => l.name === (travel.travel_locations as { name?: string } | null)?.name
  )
  const locationImage = matchedLoc?.image ?? null

  // 为每个 segment 附加 image URL
  const segmentsWithImages = (segments ?? []).map((seg: Record<string, unknown>) => {
    const segLoc = seg.travel_locations as { name?: string } | null
    const segLocalLoc = LOCATION_DB.find((l) => l.name === segLoc?.name)
    return { ...seg, location_image: segLocalLoc?.image ?? null }
  })

  const { data: journals } = await supabase
    .from('journals')
    .select('*')
    .eq('travel_id', id)
    .eq('user_id', user.id)
    .order('day_number', { ascending: true })

  return NextResponse.json({
    travel,
    segments: segmentsWithImages,
    journals: journals ?? [],
    location_image: locationImage,
  })
}
