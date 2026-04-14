'use client'

import { useState, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import ExploreScene from '@/components/explore/ExploreScene'
import type { Capybara, Exploration } from '@/types'
import { createClient } from '@/lib/supabase/client'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function ExplorePage() {
  const [capybara, setCapybara] = useState<Capybara | null>(null)
  const [currentExploration, setCurrentExploration] = useState<Exploration | null>(null)
  const [pastExplorations, setPastExplorations] = useState<Exploration[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const capRes = await fetch('/api/capybara')
    const capData = await capRes.json()
    setCapybara(capData.capybara)

    await checkExploration()
    await loadPastExplorations()
    setLoading(false)
  }

  async function checkExploration() {
    const res = await fetch('/api/explore')
    const data = await res.json()

    if (data.exploration && data.exploration.status === 'ongoing' && !data.just_completed) {
      setCurrentExploration(data.exploration)
    } else if (data.just_completed) {
      // 刚完成 → 让 ExploreScene 的 return 阶段处理
      setCurrentExploration({
        ...data.exploration,
        // 把 estimated_return 设为过去，让进度=100%
        status: 'ongoing',
      })
      // 刷新卡皮巴拉状态
      const capRes = await fetch('/api/capybara')
      setCapybara((await capRes.json()).capybara)
    } else {
      setCurrentExploration(null)
    }
  }

  async function loadPastExplorations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('explorations')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5)

    setPastExplorations(data || [])
  }

  async function startExploration() {
    const res = await fetch('/api/explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (data.exploration) {
      setCurrentExploration(data.exploration)
      const capRes = await fetch('/api/capybara')
      setCapybara((await capRes.json()).capybara)
    }
  }

  function handleExploreComplete() {
    setCurrentExploration(null)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl animate-bounce-slow">🦫</div>
        <p className="text-gray-400 mt-3 text-sm">加载中...</p>
      </div>
    )
  }

  // ==========================================
  // 有正在进行的探索 → 显示动画场景
  // ==========================================
  if (currentExploration) {
    return (
      <div className="flex flex-col h-screen">
        <ExploreScene
          exploration={currentExploration}
          capybaraName={capybara?.name || '卡皮'}
          onComplete={handleExploreComplete}
        />
        <BottomNav />
      </div>
    )
  }

  // ==========================================
  // 无探索 → 显示首页：出发按钮 + 历史记录
  // ==========================================
  return (
    <div className="flex flex-col h-screen">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-lg font-bold text-gray-800">🗺️ 探索</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        {/* 卡皮巴拉状态 */}
        <div className="text-center py-8">
          <div className="relative inline-block">
            <span className="text-6xl inline-block animate-bounce-slow">🦫</span>
            {capybara?.status === 'home' && (
              <span className="absolute -bottom-1 -right-1 text-lg">💤</span>
            )}
          </div>

          <p className="text-gray-500 mt-4 mb-6 text-sm">
            {capybara?.name}在河岸休息中~ 去聊天让它想出去探索，或直接出发！
          </p>

          <button
            onClick={startExploration}
            disabled={capybara?.status !== 'home'}
            className="px-8 py-3 bg-capybara-500 text-white rounded-xl font-medium
                       hover:bg-capybara-600 disabled:opacity-50 disabled:cursor-not-allowed transition
                       shadow-md shadow-capybara-200"
          >
            🎒 让{capybara?.name}出发探索
          </button>

          <p className="text-xs text-gray-300 mt-2">
            也可以在聊天中自然触发探索意愿
          </p>
        </div>

        {/* 历史探索 */}
        {pastExplorations.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">📖 探索记录</h3>
            <div className="space-y-2">
              {pastExplorations.map((exp) => {
                const items = (exp.items_found || []) as { name: string; rarity: string }[]
                return (
                  <div
                    key={exp.id}
                    className="p-3 bg-white rounded-xl shadow-sm border border-gray-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">
                        {{ short: '短途散步', medium: '日间远行', long: '长途冒险' }[exp.exploration_type] || '探索'}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {exp.completed_at
                          ? new Date(exp.completed_at).toLocaleDateString('zh-CN')
                          : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">
                      {exp.story?.slice(0, 80)}{(exp.story?.length || 0) > 80 ? '...' : ''}
                    </p>
                    {items.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {items.map((item, i) => (
                          <span
                            key={i}
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              item.rarity === 'rare' || item.rarity === 'legendary'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
