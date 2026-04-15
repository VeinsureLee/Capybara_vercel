'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import LocationDetail from '@/components/travel/LocationDetail'
import ContinuousProgress from '@/components/travel/ContinuousProgress'
import type { MapLocation } from '@/components/travel/WorldMap'
import { MS_PER_DAY, isTesting } from '@/lib/travel/timeConfig'

// 动态导入地图组件（SSR 不兼容 d3-geo）
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
  travel_locations?: { name: string; region: string; description: string } | null
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
}

export default function TravelPage() {
  const [travel, setTravel] = useState<TravelData | null>(null)
  const [journals, setJournals] = useState<JournalData[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)
  const [resting, setResting] = useState(false)
  const [restUntil, setRestUntil] = useState<string | null>(null)

  // 手记生成阻塞
  const [generatingJournal, setGeneratingJournal] = useState(false)
  const [journalError, setJournalError] = useState<string | null>(null)

  // 地图相关
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [activeLocationName, setActiveLocationName] = useState<string | null>(null)

  // 历史旅行记录
  const [history, setHistory] = useState<TravelHistoryItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)

  // 实时倒计时（仅用于休息期，进度条组件自管理）
  const [now, setNow] = useState(Date.now())

  const loadTravel = useCallback(async () => {
    const res = await fetch('/api/travel')
    const data = await res.json()
    setTravel(data.travel)
    setJournals(data.journals ?? [])

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

  // 休息期倒计时
  useEffect(() => {
    if (!resting) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [resting])

  // 轮询旅行状态
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
      } else if (data.error) {
        setMessage(data.error)
      }
    } catch {
      setMessage('出发失败了...')
    } finally {
      setStarting(false)
    }
  }

  // V2.1: 带阻塞的手记生成
  const daysPassed = travel
    ? Math.min(
        Math.floor((Date.now() - new Date(travel.started_at).getTime()) / MS_PER_DAY) + 1,
        travel.duration_days
      )
    : 0

  async function generateJournal() {
    if (generatingJournal) return // 防重复点击
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
          // 天数不一致，刷新旅行状态
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

  /** 格式化剩余时间 */
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

  /** 格式化日期范围 */
  function formatDateRange(start: string, end: string): string {
    const s = new Date(start)
    const e = new Date(end)
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(s)} - ${fmt(e)}`
  }

  const canTravel = !travel && !resting
  const locationName = travel?.travel_locations?.name ?? '远方'
  const canGenerateJournal = travel && travel.status === 'traveling' && daysPassed > journals.length

  return (
    <div className="flex flex-col h-screen">
      {/* 顶栏 */}
      <div className="px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100">
        <h1 className="font-bold text-gray-800">🗺️ 世界地图</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">点击地点查看详情</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 世界地图 */}
        <WorldMap
          locations={locations}
          onSelectLocation={setSelectedLocation}
          activeLocationName={activeLocationName}
        />

        {/* ===== 当前旅行状态卡片 ===== */}
        {travel && travel.status === 'traveling' && (
          <div className="p-4 bg-gradient-to-br from-river-50 to-meadow-50 rounded-2xl border border-river-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🦫</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{locationName}</p>
                <p className="text-xs text-gray-500">{travel.travel_locations?.region}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3">{travel.travel_locations?.description}</p>

            {/* V2.1: 连续进度条 */}
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

            {/* V2.1: 带阻塞的手记生成按钮 */}
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

            {/* 已生成手记数量提示 */}
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

        {/* ===== 无旅行 + 不在休息 = 可以出发 ===== */}
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
                        {item.duration_days}天 · {item.journal_count}篇手记
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

      {/* 地点详情面板 */}
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
