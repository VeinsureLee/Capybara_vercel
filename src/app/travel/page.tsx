'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import LocationDetail from '@/components/travel/LocationDetail'
import ContinuousProgress from '@/components/travel/ContinuousProgress'
import type { MapLocation } from '@/components/travel/WorldMap'
import { MS_PER_DAY, isTesting } from '@/lib/travel/timeConfig'

const WorldMap = dynamic(() => import('@/components/travel/WorldMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-56 bg-river-50 rounded-2xl flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-river-300 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

interface TravelData {
  id: string
  status: string
  duration_days: number
  started_at: string
  estimated_return: string
  completed_at?: string
  current_segment_order?: number
  travel_locations?: { name: string; region: string; description: string } | null
}

interface SegmentData {
  id: string
  segment_order: number
  started_at: string
  ended_at?: string | null
  duration_days: number
  visit_count: number
  travel_locations?: { name: string; region: string; description: string } | null
  location_image?: string | null
}

interface JournalData {
  id: string
  day_number: number
  location_name: string
  narrative: string
  encounter_narrative?: string | null
  daily_item?: { name: string; description: string; rarity: string } | null
  created_at: string
}

interface TravelHistoryItem {
  id: string
  location_name: string
  region: string
  duration_days: number
  started_at: string
  completed_at: string
  journal_count: number
  item_count: number
  segment_count: number
}

export default function TravelPage() {
  const [travel, setTravel] = useState<TravelData | null>(null)
  const [journals, setJournals] = useState<JournalData[]>([])
  const [segments, setSegments] = useState<SegmentData[]>([])
  const [currentSegment, setCurrentSegment] = useState<SegmentData | null>(null)
  const [justMoved, setJustMoved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)
  const [resting, setResting] = useState(false)
  const [restUntil, setRestUntil] = useState<string | null>(null)

  const [generatingJournal, setGeneratingJournal] = useState(false)
  const [journalError, setJournalError] = useState<string | null>(null)

  const [locations, setLocations] = useState<MapLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [activeLocationName, setActiveLocationName] = useState<string | null>(null)

  const [history, setHistory] = useState<TravelHistoryItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)

  const [now, setNow] = useState(Date.now())

  const loadTravel = useCallback(async () => {
    const res = await fetch('/api/travel')
    const data = await res.json()
    setTravel(data.travel)
    setJournals(data.journals ?? [])
    setSegments(data.segments ?? [])
    setCurrentSegment(data.current_segment ?? null)

    if (data.just_moved) {
      setJustMoved(data.moved_to)
      setTimeout(() => setJustMoved(null), 5000)
    }

    if (data.just_completed) {
      setJustCompleted(true)
      setResting(true)
      setRestUntil(data.rest_until ?? null)
    } else if (data.capybara_status === 'resting') {
      setResting(true)
      setRestUntil(data.rest_until ?? null)
    } else {
      setResting(false)
      setRestUntil(null)
      if (data.just_rested) setJustCompleted(false)
    }

    setLoading(false)
  }, [])

  async function loadLocations() {
    const res = await fetch('/api/travel/locations')
    const data = await res.json()
    setLocations(data.locations ?? [])
    setActiveLocationName(data.activeLocationName ?? null)
  }

  async function loadHistory() {
    const res = await fetch('/api/travel/history?page=1&limit=10')
    const data = await res.json()
    setHistory(data.travels ?? [])
    setHistoryTotal(data.total ?? 0)
  }

  useEffect(() => {
    loadTravel()
    loadLocations()
    loadHistory()
  }, [loadTravel])

  useEffect(() => {
    if (!resting) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [resting])

  useEffect(() => {
    if (travel?.status !== 'traveling') return
    const pollMs = isTesting ? 10000 : 30000
    const interval = setInterval(() => {
      loadTravel()
      loadLocations()
    }, pollMs)
    return () => clearInterval(interval)
  }, [travel?.status, loadTravel])

  async function startTravel() {
    setStarting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedLocation ? { location_name: selectedLocation.name } : {}),
      })
      const data = await res.json()

      if (data.refused) {
        setMessage(data.message)
      } else if (data.travel) {
        setTravel(data.travel)
        setMessage(data.departure_message)
        setSelectedLocation(null)
        await loadLocations()
        await loadTravel()
      } else if (data.error) {
        setMessage(data.error)
      }
    } catch {
      setMessage('出发失败了...')
    } finally {
      setStarting(false)
    }
  }

  const daysPassed = travel
    ? Math.min(
        Math.floor((Date.now() - new Date(travel.started_at).getTime()) / MS_PER_DAY) + 1,
        travel.duration_days
      )
    : 0

  async function generateJournal() {
    if (generatingJournal) return
    setGeneratingJournal(true)
    setJournalError(null)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_day: daysPassed }),
      })
      const data = await res.json()

      if (res.status === 409) {
        if (data.code === 'DAY_CONFLICT') {
          setJournalError('天数已变更，正在刷新...')
          await loadTravel()
        } else {
          setJournalError('今日手记已生成')
        }
      } else if (data.journal) {
        setJournals((prev) => [...prev, data.journal])
      } else if (data.error) {
        setJournalError(data.error)
      }
    } catch {
      setJournalError('生成失败，请重试')
    } finally {
      setGeneratingJournal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl animate-bounce">🗺️</div>
        <p className="text-gray-400 mt-4 text-sm">加载中...</p>
      </div>
    )
  }

  function formatRemaining(ms: number): string {
    if (ms <= 0) return '即将恢复'
    const totalSec = Math.ceil(ms / 1000)
    if (totalSec < 60) return `${totalSec} 秒`
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    if (min < 60) return sec > 0 ? `${min} 分 ${sec} 秒` : `${min} 分钟`
    const hr = Math.floor(min / 60)
    const remMin = min % 60
    return remMin > 0 ? `${hr} 小时 ${remMin} 分` : `${hr} 小时`
  }

  function formatDateRange(start: string, end: string): string {
    const s = new Date(start)
    const e = new Date(end)
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(s)} - ${fmt(e)}`
  }

  const canTravel = !travel && !resting
  const locationName = currentSegment?.travel_locations?.name ?? travel?.travel_locations?.name ?? '远方'
  const canGenerateJournal = travel && travel.status === 'traveling' && daysPassed > journals.length

  return (
    <div className="flex flex-col h-screen">
      <div className="px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100">
        <h1 className="font-bold text-gray-800">🗺️ 世界地图</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">点击地点查看详情</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <WorldMap
          locations={locations}
          onSelectLocation={setSelectedLocation}
          activeLocationName={activeLocationName}
        />

        {/* ===== 当前旅行状态卡片 ===== */}
        {travel && travel.status === 'traveling' && (
          <div className="p-4 bg-gradient-to-br from-river-50 to-meadow-50 rounded-2xl border border-river-100">
            {/* 跳转提示 */}
            {justMoved && (
              <div className="mb-3 p-2 bg-meadow-100 rounded-lg text-center">
                <p className="text-xs text-meadow-700">🦫 卡皮觉得待够了，跑去了 {justMoved}！</p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🦫</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{locationName}</p>
                <p className="text-xs text-gray-500">
                  {currentSegment?.travel_locations?.region ?? travel.travel_locations?.region}
                  {currentSegment && currentSegment.visit_count > 1 && (
                    <span className="ml-1 text-amber-500">（第{currentSegment.visit_count}次来）</span>
                  )}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              {currentSegment?.travel_locations?.description ?? travel.travel_locations?.description}
            </p>

            {/* 旅行路线面包屑 */}
            {segments.length > 1 && (
              <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                {segments.map((seg, i) => {
                  const segLoc = seg.travel_locations as { name: string } | null
                  const isCurrent = seg.segment_order === (travel.current_segment_order ?? 1)
                  return (
                    <div key={seg.id} className="flex items-center shrink-0">
                      {i > 0 && <span className="text-gray-300 mx-0.5 text-[10px]">→</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isCurrent
                          ? 'bg-capybara-500 text-white'
                          : seg.ended_at ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-400'
                      }`}>
                        {segLoc?.name?.split('·')[0] ?? '?'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <ContinuousProgress
              startedAt={travel.started_at}
              estimatedReturn={travel.estimated_return}
              durationDays={travel.duration_days}
            />

            {isTesting && (
              <p className="text-[10px] text-river-400 mt-2">
                🛠 开发模式：1天 = 1分钟
              </p>
            )}

            {canGenerateJournal && (
              <button
                onClick={generateJournal}
                disabled={generatingJournal}
                className="w-full mt-3 py-2.5 bg-capybara-500 text-white rounded-xl text-sm font-medium
                           hover:bg-capybara-600 transition disabled:opacity-40 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {generatingJournal ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    正在生成手记...
                  </>
                ) : (
                  `生成今日手记 (第 ${journals.length + 1} 天)`
                )}
              </button>
            )}
            {journalError && (
              <p className="mt-2 text-xs text-amber-600 text-center">{journalError}</p>
            )}

            {journals.length > 0 && (
              <p className="mt-2 text-[11px] text-gray-400 text-center">
                已生成 {journals.length} 篇手记
                {travel && (
                  <Link
                    href={`/travel/${travel.id}`}
                    className="text-capybara-500 ml-1 hover:underline"
                  >
                    查看详情 →
                  </Link>
                )}
              </p>
            )}
          </div>
        )}

        {/* ===== 休息中 ===== */}
        {(justCompleted || resting) && !travel && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
            <p className="text-2xl mb-2">😴</p>
            <p className="text-sm text-amber-800 font-medium">
              {justCompleted ? '旅行结束了！' : ''}卡皮在休息中~
            </p>
            {restUntil && (
              <p className="text-xs text-amber-600 mt-1">
                {formatRemaining(new Date(restUntil).getTime() - now)}后恢复精力
              </p>
            )}
            {isTesting && (
              <p className="text-[10px] text-river-400 mt-1">
                🛠 开发模式：1天 = 1分钟
              </p>
            )}
          </div>
        )}

        {/* ===== 可以出发 ===== */}
        {canTravel && (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm mb-3">在地图上选一个地点，或让卡皮自己决定~</p>
            <button
              onClick={startTravel}
              disabled={starting}
              className="px-8 py-3 bg-capybara-500 text-white rounded-xl text-sm font-medium
                         hover:bg-capybara-600 transition disabled:opacity-40"
            >
              {starting ? '出发中...' : '让卡皮随心出发'}
            </button>
            {message && (
              <p className="mt-3 text-sm text-gray-600 bg-white/80 rounded-lg px-4 py-2 inline-block">
                {message}
              </p>
            )}
          </div>
        )}

        {/* ===== 探索记录 ===== */}
        {history.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-600">探索记录</h3>
              {historyTotal > 10 && (
                <Link
                  href="/travel/history"
                  className="text-xs text-capybara-500 hover:underline"
                >
                  查看全部 ({historyTotal}) →
                </Link>
              )}
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <Link
                  key={item.id}
                  href={`/travel/${item.id}`}
                  className="block p-3 bg-white rounded-xl shadow-sm border border-gray-50 hover:border-capybara-100 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">📍</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {item.location_name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {item.region} · {formatDateRange(item.started_at, item.completed_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-[11px] text-gray-500">
                        {item.duration_days}天{item.segment_count > 1 ? ` · ${item.segment_count}站` : ''} · {item.journal_count}篇手记
                      </p>
                      {item.item_count > 0 && (
                        <p className="text-[10px] text-capybara-500">
                          {item.item_count}件物品
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {historyTotal > 10 && (
              <Link
                href="/travel/history"
                className="block mt-2 py-2.5 text-center text-sm text-capybara-500 bg-capybara-50 rounded-xl hover:bg-capybara-100 transition"
              >
                查看更多探索记录 →
              </Link>
            )}
          </section>
        )}
      </div>

      <LocationDetail
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
        onStartTravel={startTravel}
        canTravel={canTravel}
        starting={starting}
      />

      <BottomNav />
    </div>
  )
}
