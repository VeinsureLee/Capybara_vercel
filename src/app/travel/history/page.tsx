'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

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

export default function TravelHistoryPage() {
  const [items, setItems] = useState<TravelHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)

  const loadPage = useCallback(async (pageNum: number) => {
    const res = await fetch(`/api/travel/history?page=${pageNum}&limit=10`)
    const data = await res.json()
    return data
  }, [])

  // 首次加载
  useEffect(() => {
    loadPage(1).then((data) => {
      setItems(data.travels ?? [])
      setHasMore(data.has_more ?? false)
      setLoading(false)
    })
  }, [loadPage])

  // 无限滚动
  useEffect(() => {
    if (!hasMore || loadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true)
          const nextPage = page + 1
          loadPage(nextPage).then((data) => {
            setItems((prev) => [...prev, ...(data.travels ?? [])])
            setHasMore(data.has_more ?? false)
            setPage(nextPage)
            setLoadingMore(false)
          })
        }
      },
      { threshold: 0.1 }
    )
    const el = observerRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [hasMore, loadingMore, page, loadPage])

  function formatDateRange(start: string, end: string): string {
    const s = new Date(start)
    const e = new Date(end)
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(s)} - ${fmt(e)}`
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl animate-bounce">📋</div>
        <p className="text-gray-400 mt-4 text-sm">加载中...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 顶栏 */}
      <div className="px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100 flex items-center gap-3">
        <Link href="/travel" className="text-gray-400 hover:text-gray-600">
          ← 返回
        </Link>
        <h1 className="font-bold text-gray-800 text-sm">探索记录</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-gray-400 text-sm">还没有探索记录</p>
            <Link href="/travel" className="text-capybara-500 text-sm mt-2 inline-block hover:underline">
              去探索世界 →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
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

            {/* 无限滚动触发器 */}
            <div ref={observerRef} className="h-8 flex items-center justify-center">
              {loadingMore && (
                <div className="w-5 h-5 border-2 border-capybara-300 border-t-transparent rounded-full animate-spin" />
              )}
              {!hasMore && items.length > 0 && (
                <p className="text-xs text-gray-300">没有更多了~</p>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
