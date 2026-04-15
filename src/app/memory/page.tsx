'use client'

import { useState, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'

interface MemoryEntry {
  id: string
  topic: string
  summary: string
  emotion?: string
  shareable: boolean
  sensitive_category?: string | null
  created_at: string
}

type Filter = 'all' | 'shareable' | 'private'

const emotionIcon: Record<string, string> = {
  '开心': '☀️',
  '难过': '🌧️',
  '怀念': '🍂',
  '焦虑': '🌊',
  '平静': '🌿',
  '感恩': '🌸',
  '孤独': '🌙',
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    loadMemories()
  }, [filter])

  async function loadMemories() {
    setLoading(true)
    const res = await fetch(`/api/memory?filter=${filter}`)
    const data = await res.json()
    setMemories(data.memories ?? [])
    setLoading(false)
  }

  async function toggleShareable(id: string, currentShareable: boolean) {
    setTogglingId(id)
    await fetch('/api/memory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, shareable: !currentShareable }),
    })
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, shareable: !currentShareable } : m))
    )
    setTogglingId(null)
  }

  async function deleteMemory(id: string) {
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  const filterTabs: { value: Filter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'shareable', label: '可分享' },
    { value: 'private', label: '私密' },
  ]

  return (
    <div className="flex flex-col h-screen">
      {/* 顶栏 */}
      <div className="px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100">
        <h1 className="font-bold text-gray-800">卡皮的小本子</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">这些是卡皮记住的你的故事</p>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 px-4 py-2 bg-white/60">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filter === tab.value
                ? 'bg-capybara-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-300 self-center">
          {memories.length} 条记忆
        </span>
      </div>

      {/* 记忆列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="text-center py-16 text-gray-300 text-sm">加载中...</div>
        ) : memories.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-400 text-sm">还没有记忆</p>
            <p className="text-gray-300 text-xs mt-1">和卡皮聊天，它会悄悄记住重要的事~</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {memories.map((m) => (
              <div
                key={m.id}
                className="p-3 bg-white rounded-xl shadow-sm border border-gray-50"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">
                      {emotionIcon[m.emotion ?? ''] ?? '💭'}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{m.topic}</span>
                  </div>
                  <button
                    onClick={() => toggleShareable(m.id, m.shareable)}
                    disabled={togglingId === m.id}
                    className={`text-xs px-2 py-0.5 rounded-full transition ${
                      m.shareable
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    } disabled:opacity-50`}
                    title={m.shareable ? '点击设为私密' : '点击设为可分享'}
                  >
                    {m.shareable ? '🔓 可分享' : '🔒 私密'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{m.summary}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-gray-300">
                    {new Date(m.created_at).toLocaleDateString('zh-CN')}
                  </p>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    className="text-[10px] text-gray-300 hover:text-red-400 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
