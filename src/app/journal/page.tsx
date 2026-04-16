'use client'

import { useState, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'

interface JournalEntry {
  id: string
  travel_id: string
  day_number: number
  location_name: string
  narrative: string
  encounter_narrative?: string | null
  encounter_user_id?: string | null
  daily_item?: { name: string; description: string; category: string; rarity: string } | null
  image_url?: string | null
  literary_quote?: string | null
  quote_source?: string | null
  created_at: string
}

const rarityColor: Record<string, string> = {
  common: 'bg-gray-100 text-gray-600',
  uncommon: 'bg-green-100 text-green-700',
  rare: 'bg-blue-100 text-blue-700',
  legendary: 'bg-purple-100 text-purple-700',
}

export default function JournalPage() {
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<JournalEntry | null>(null)

  useEffect(() => {
    loadJournals()
  }, [])

  async function loadJournals() {
    const res = await fetch('/api/journal')
    const data = await res.json()
    setJournals(data.journals ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl animate-bounce-slow">📖</div>
        <p className="text-gray-400 mt-4 text-sm">加载手记...</p>
      </div>
    )
  }

  // 详情视图
  if (selected) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100">
          <button onClick={() => setSelected(null)} className="text-gray-500 text-sm">
            ← 返回
          </button>
          <div className="flex-1 text-center">
            <span className="font-semibold text-gray-800 text-sm">第 {selected.day_number} 天</span>
            <span className="text-xs text-gray-400 ml-2">{selected.location_name}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 探索图片 */}
          {selected.image_url ? (
            <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.image_url}
                alt={selected.location_name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-white font-bold text-lg drop-shadow">{selected.location_name}</p>
                <p className="text-white/80 text-xs drop-shadow">
                  {new Date(selected.created_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 px-4">
              <p className="text-lg font-bold text-gray-800">{selected.location_name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(selected.created_at).toLocaleDateString('zh-CN')}
              </p>
            </div>
          )}

          <div className="px-4 py-4">
          {/* 文学引用 */}
          {selected.literary_quote && (
            <div className="p-4 bg-gradient-to-br from-river-50 to-meadow-50 rounded-2xl border border-river-100 mb-4">
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;{selected.literary_quote}&rdquo;
              </p>
              {selected.quote_source && (
                <p className="text-xs text-gray-400 mt-2 text-right">—— {selected.quote_source}</p>
              )}
            </div>
          )}

          {/* 叙事 */}
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-50 mb-4">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {selected.narrative}
            </p>
          </div>

          {/* 相遇段落 */}
          {selected.encounter_narrative && (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 mb-4">
              <p className="text-xs font-medium text-amber-700 mb-1.5">✨ 在路上遇到了另一只卡皮</p>
              <p className="text-sm text-amber-800 leading-relaxed">
                {selected.encounter_narrative}
              </p>
            </div>
          )}

          {/* 发现物品 */}
          {selected.daily_item && (
            <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-50 flex items-center gap-3">
              <div className="w-10 h-10 bg-capybara-50 rounded-lg flex items-center justify-center text-lg">
                🎁
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{selected.daily_item.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${rarityColor[selected.daily_item.rarity] || rarityColor.common}`}>
                    {selected.daily_item.rarity}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{selected.daily_item.description}</p>
              </div>
            </div>
          )}
          </div>
        </div>

        <BottomNav />
      </div>
    )
  }

  // 列表视图
  return (
    <div className="flex flex-col h-screen">
      <div className="px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100">
        <h1 className="font-bold text-gray-800">旅行手记</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {journals.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-gray-400 text-sm">还没有手记</p>
            <p className="text-gray-300 text-xs mt-1">让卡皮去旅行，每天都会写下手记~</p>
          </div>
        ) : (
          <div className="space-y-3">
            {journals.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelected(j)}
                className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-50 hover:shadow-md transition overflow-hidden"
              >
                {j.image_url && (
                  <div className="w-full h-28 bg-gray-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={j.image_url} alt={j.location_name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-capybara-600">第 {j.day_number} 天</span>
                      <span className="text-xs text-gray-400">{j.location_name}</span>
                    </div>
                    {j.encounter_narrative && <span className="text-xs">✨</span>}
                  </div>
                  {j.literary_quote && (
                    <p className="text-xs text-river-500 italic line-clamp-1 mb-1">
                      &ldquo;{j.literary_quote}&rdquo;
                    </p>
                  )}
                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                    {j.narrative}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-gray-300">
                      {new Date(j.created_at).toLocaleDateString('zh-CN')}
                    </p>
                    {j.daily_item && (
                      <span className="text-[10px] bg-capybara-50 text-capybara-600 px-1.5 py-0.5 rounded-full">
                        {j.daily_item.name}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
