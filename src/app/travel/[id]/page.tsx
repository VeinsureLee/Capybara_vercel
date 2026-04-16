'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ImageDetailView from '@/components/travel/ImageDetailView'
import type { VisualHighlight } from '@/types'

interface TravelDetail {
  id: string
  status: string
  duration_days: number
  started_at: string
  estimated_return: string
  completed_at?: string
  items_found?: ItemData[]
  matched_user_id?: string | null
  travel_locations?: {
    name: string
    region: string
    description: string
    tags?: string[]
    visual_keywords?: string[]
  } | null
}

interface JournalDetail {
  id: string
  day_number: number
  location_name: string
  narrative: string
  encounter_narrative?: string | null
  encounter_user_id?: string | null
  daily_item?: ItemData | null
  visual_highlights?: VisualHighlight[] | null
  created_at: string
}

interface SegmentDetail {
  id: string
  segment_order: number
  duration_days: number
  visit_count: number
  started_at: string
  ended_at?: string | null
  travel_locations?: { name: string; region: string; description: string } | null
  location_image?: string | null
}

interface ItemData {
  name: string
  description: string
  category?: string
  rarity: string
}

const RARITY_STYLES: Record<string, string> = {
  common: 'bg-gray-50 border-gray-200 text-gray-600',
  uncommon: 'bg-green-50 border-green-200 text-green-700',
  rare: 'bg-blue-50 border-blue-200 text-blue-700',
  legendary: 'bg-purple-50 border-purple-200 text-purple-700',
}

const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  uncommon: '优良',
  rare: '稀有',
  legendary: '传说',
}

export default function TravelDetailPage() {
  const params = useParams()
  const travelId = params.id as string

  const [travel, setTravel] = useState<TravelDetail | null>(null)
  const [journals, setJournals] = useState<JournalDetail[]>([])
  const [segments, setSegments] = useState<SegmentDetail[]>([])
  const [locationImage, setLocationImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageDetailOpen, setImageDetailOpen] = useState(false)

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/travel/${travelId}`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const data = await res.json()
    setTravel(data.travel ?? null)
    setJournals(data.journals ?? [])
    setSegments(data.segments ?? [])
    setLocationImage(data.location_image ?? null)
    setLoading(false)
  }, [travelId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl animate-bounce">📖</div>
        <p className="text-gray-400 mt-4 text-sm">加载中...</p>
      </div>
    )
  }

  if (!travel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm">旅行记录不存在</p>
        <Link href="/travel" className="mt-4 text-capybara-500 text-sm hover:underline">
          ← 返回地图
        </Link>
      </div>
    )
  }

  const location = travel.travel_locations
  const allItems = (travel.items_found ?? []) as ItemData[]

  // 收集所有手记的 visual_highlights
  const allHighlights: (VisualHighlight & { journalId: string; dayNumber: number })[] = []
  journals.forEach((j) => {
    if (j.visual_highlights) {
      j.visual_highlights.forEach((h) => {
        allHighlights.push({ ...h, journalId: j.id, dayNumber: j.day_number })
      })
    }
  })

  // 地点图片 URL：优先用 API 返回的真实图片，无则不显示图片区
  const locationImageUrl = locationImage ?? null

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 顶栏 */}
      <div className="px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100 flex items-center gap-3">
        <Link href="/travel" className="text-gray-400 hover:text-gray-600">
          ← 返回
        </Link>
        <h1 className="font-bold text-gray-800 text-sm">旅行详情</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 地点大图（可点击查看标注） */}
        {locationImageUrl ? (
          <div className="relative">
            <button
              onClick={() => setImageDetailOpen(true)}
              className="w-full h-52 bg-gray-100 overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={locationImageUrl}
                alt={location?.name ?? '旅行地点'}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
              {allHighlights.length > 0 && (
                <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full">
                  点击查看 {allHighlights.length} 个标注
                </div>
              )}
            </button>
          </div>
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-river-50 to-meadow-50 flex items-center justify-center">
            <span className="text-4xl">🗺️</span>
          </div>
        )}

        <div className="px-4 py-4 space-y-5">
          {/* 地点信息头 */}
          <div>
            <h2 className="text-lg font-bold text-gray-800">{location?.name ?? '未知地点'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {location?.region} · {formatDate(travel.started_at)} - {travel.completed_at ? formatDate(travel.completed_at) : '旅行中'} · {travel.duration_days}天
            </p>
            {location?.description && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{location.description}</p>
            )}
            {location?.tags && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {location.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 bg-river-50 text-river-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 旅行路线概览 */}
          {segments.length > 1 && (
            <div className="p-3 bg-gradient-to-r from-river-50 to-meadow-50 rounded-xl">
              <p className="text-xs font-medium text-gray-600 mb-2">旅行路线</p>
              <div className="flex items-center gap-1 flex-wrap">
                {segments.map((seg, i) => {
                  const segLoc = seg.travel_locations as { name: string } | null
                  return (
                    <div key={seg.id} className="flex items-center">
                      {i > 0 && <span className="text-gray-300 mx-1">→</span>}
                      <span className="text-[11px] px-2 py-0.5 bg-white rounded-full text-gray-700 shadow-sm">
                        {segLoc?.name?.split('·').pop() ?? '?'}
                        {seg.visit_count > 1 && <span className="text-amber-500 ml-0.5">×{seg.visit_count}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 旅途手记 */}
          {journals.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">旅途手记</h3>
              <div className="space-y-3">
                {journals.map((j) => (
                  <div key={j.id} className="p-3 bg-white rounded-xl shadow-sm border border-gray-50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs font-medium text-capybara-600">第 {j.day_number} 天</span>
                      <span className="text-[10px] text-gray-400">{j.location_name}</span>
                      {j.daily_item && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ml-auto ${
                          RARITY_STYLES[j.daily_item.rarity] ?? RARITY_STYLES.common
                        }`}>
                          {j.daily_item.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{j.narrative}</p>
                    {j.encounter_narrative && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <p className="text-xs text-amber-700">✨ {j.encounter_narrative}</p>
                      </div>
                    )}
                    {/* 视觉标注提示 */}
                    {j.visual_highlights && j.visual_highlights.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {j.visual_highlights.map((h, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 bg-meadow-50 text-meadow-600 rounded-full cursor-pointer hover:bg-meadow-100"
                            onClick={() => setImageDetailOpen(true)}
                          >
                            📌 {h.keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 收集物品 */}
          {allItems.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">收集物品</h3>
              <div className="grid grid-cols-2 gap-2">
                {allItems.map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border ${RARITY_STYLES[item.rarity] ?? RARITY_STYLES.common}`}
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-[11px] opacity-70 mt-0.5">{item.description}</p>
                    <p className="text-[10px] mt-1 opacity-50">
                      {RARITY_LABELS[item.rarity] ?? '普通'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 偶遇记录 */}
          {travel.matched_user_id && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">旅途偶遇</h3>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-sm text-amber-800">
                  这次旅行中遇到了一位有相似经历的旅伴，在手记中记录了相遇的故事。
                </p>
              </div>
            </section>
          )}

          {/* 无手记时的提示 */}
          {journals.length === 0 && travel.status === 'traveling' && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">旅行还在进行中，手记会在每天生成~</p>
            </div>
          )}
        </div>
      </div>

      {/* 图片标注详情视图 */}
      {imageDetailOpen && locationImageUrl && (
        <ImageDetailView
          imageUrl={locationImageUrl}
          locationName={location?.name ?? '未知地点'}
          region={location?.region ?? ''}
          highlights={allHighlights}
          onClose={() => setImageDetailOpen(false)}
        />
      )}

      <BottomNav />
    </div>
  )
}
