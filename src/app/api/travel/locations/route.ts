import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { LOCATION_DB } from '@/lib/travel/locations'

/**
 * GET /api/travel/locations — 返回所有地点（含坐标、图片）+ 当前旅行地点
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 查当前旅行地点
  const { data: activeTravel } = await supabase
    .from('travels')
    .select('location_id, travel_locations(name)')
    .eq('user_id', user.id)
    .eq('status', 'traveling')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  const locData = activeTravel?.travel_locations as { name: string } | { name: string }[] | null
  const activeName = activeTravel
    ? (Array.isArray(locData) ? locData[0]?.name : locData?.name) ?? null
    : null

  // 按区域分组
  const regions: Record<string, typeof LOCATION_DB> = {}
  for (const loc of LOCATION_DB) {
    const r = loc.region.split('·')[0] // "中国·云南" → "中国"
    if (!regions[r]) regions[r] = []
    regions[r].push(loc)
  }

  return NextResponse.json({
    locations: LOCATION_DB.map((loc) => ({
      name: loc.name,
      region: loc.region,
      tags: loc.tags,
      description: loc.description,
      lat: loc.lat,
      lng: loc.lng,
      image: loc.image,
      isActive: loc.name === activeName,
    })),
    activeLocationName: activeName,
    regions: Object.keys(regions),
  })
}
