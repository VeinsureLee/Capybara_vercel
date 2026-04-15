'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import type { Capybara, Exploration, ExplorationItem } from '@/types'

export default function HomePage() {
  const [capybara, setCapybara] = useState<Capybara | null>(null)
  const [recentExplorations, setRecentExplorations] = useState<Exploration[]>([])
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [itemsSectionOpen, setItemsSectionOpen] = useState(true)
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null)
  const [logsSectionOpen, setLogsSectionOpen] = useState(true)
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // 获取卡皮巴拉
    const capRes = await fetch('/api/capybara')
    const capData = await capRes.json()
    setCapybara(capData.capybara)

    // 获取最近的已完成探索
    if (capData.capybara) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('explorations')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(10)

        setRecentExplorations(data || [])
      }
    }

    setLoading(false)
  }

  // 收集所有探索获得的物品
  const allItems: ExplorationItem[] = recentExplorations.flatMap(
    (exp) => (exp.items_found || []) as ExplorationItem[]
  )

  const rarityColor: Record<string, string> = {
    common: 'bg-gray-100 text-gray-600',
    uncommon: 'bg-green-100 text-green-700',
    rare: 'bg-blue-100 text-blue-700',
    legendary: 'bg-purple-100 text-purple-700',
  }

  const rarityLabel: Record<string, string> = {
    common: '普通',
    uncommon: '不常见',
    rare: '稀有',
    legendary: '传说',
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl animate-bounce-slow">🦫</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 河岸场景 */}
      <div className="relative bg-gradient-to-b from-meadow-100 via-meadow-50 to-river-100 p-6 pt-10 pb-8">
        {/* 设置按钮 */}
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur text-gray-500 hover:bg-white/80 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition disabled:opacity-50"
              >
                {loggingOut ? '退出中...' : '退出登录'}
              </button>
            </div>
          )}
        </div>

        {/* 背景装饰 */}
        <div className="absolute top-3 left-4 text-2xl opacity-30">🌿</div>
        <div className="absolute top-6 right-6 text-xl opacity-30">🌸</div>
        <div className="absolute bottom-2 left-8 text-lg opacity-20">
          ~ ~ ~ 🌊 ~ ~ ~
        </div>
        <div className="absolute bottom-2 right-4 text-lg opacity-20">
          🌿
        </div>

        {/* 卡皮巴拉 */}
        <div className="text-center relative z-10">
          <div className="text-6xl mb-2 animate-bounce-slow">🦫</div>
          <h2 className="text-lg font-bold text-capybara-700">
            {capybara?.name || '卡皮'}的河岸
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {capybara?.status === 'home' && '在家休息中~'}
            {capybara?.status === 'exploring' && '出去探索了，等它回来~'}
            {capybara?.status === 'visiting' && '去别人家串门了~'}
            {capybara?.status === 'traveling' && '正在旅行中... 🗺️'}
            {capybara?.status === 'resting' && '旅行刚回来，在休息~ 💤'}
          </p>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 收集的物品 */}
        <section>
          <button
            onClick={() => setItemsSectionOpen(!itemsSectionOpen)}
            className="flex items-center justify-between w-full mb-2"
          >
            <h3 className="text-sm font-semibold text-gray-600">
              📦 收集的物品 ({allItems.length})
            </h3>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${itemsSectionOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {itemsSectionOpen && (
            allItems.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-sm">
                还没有物品，和{capybara?.name || '卡皮'}聊聊天让它去探索吧~
              </div>
            ) : (
              <div className="space-y-2">
                {allItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setExpandedItemIndex(expandedItemIndex === i ? null : i)}
                    className="w-full text-left p-3 bg-white rounded-xl shadow-sm border border-gray-50 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            rarityColor[item.rarity] || rarityColor.common
                          }`}
                        >
                          {rarityLabel[item.rarity] || '普通'}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-3 h-3 text-gray-300 transition-transform duration-200 ${expandedItemIndex === i ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {expandedItemIndex === i && (
                      <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">
                        {item.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}
        </section>

        {/* 探索日志 */}
        <section>
          <button
            onClick={() => setLogsSectionOpen(!logsSectionOpen)}
            className="flex items-center justify-between w-full mb-2"
          >
            <h3 className="text-sm font-semibold text-gray-600">
              📖 探索日志 ({recentExplorations.length})
            </h3>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${logsSectionOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {logsSectionOpen && (
            recentExplorations.length === 0 ? (
              <div className="text-center py-6 text-gray-300 text-sm">
                暂无探索记录
              </div>
            ) : (
              <div className="space-y-2">
                {recentExplorations.map((exp, i) => (
                  <button
                    key={exp.id}
                    onClick={() => setExpandedLogIndex(expandedLogIndex === i ? null : i)}
                    className="w-full text-left p-3 bg-white rounded-xl shadow-sm border border-gray-50 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700 truncate flex-1 mr-2">
                        {exp.story ? exp.story.slice(0, 30) + (exp.story.length > 30 ? '...' : '') : '探索记录'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-gray-300">
                          {exp.completed_at
                            ? new Date(exp.completed_at).toLocaleDateString('zh-CN')
                            : ''}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-3 h-3 text-gray-300 transition-transform duration-200 ${expandedLogIndex === i ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {expandedLogIndex === i && (
                      <div className="mt-2 pt-2 border-t border-gray-50">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {exp.story}
                        </p>
                        <p className="text-[10px] text-gray-300 mt-2">
                          {exp.completed_at
                            ? new Date(exp.completed_at).toLocaleString('zh-CN')
                            : ''}
                        </p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )
          )}
        </section>

        {/* 卡皮巴拉信息卡 */}
        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            🦫 关于 {capybara?.name}
          </h3>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-50">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">性格</span>
                <p className="text-gray-700">
                  {(capybara?.traits as string[])?.join('、')}
                </p>
              </div>
              <div>
                <span className="text-gray-400">等级</span>
                <p className="text-gray-700">Lv.{capybara?.level}</p>
              </div>
              <div>
                <span className="text-gray-400">心情</span>
                <p className="text-gray-700">{capybara?.mood}</p>
              </div>
              <div>
                <span className="text-gray-400">经验</span>
                <p className="text-gray-700">{capybara?.experience}</p>
              </div>
            </div>
            {((capybara?.memory as string[]) || []).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <span className="text-gray-400 text-xs">共同回忆</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {((capybara?.memory as string[]) || []).map((m, i) => (
                    <span
                      key={i}
                      className="text-xs bg-capybara-50 text-capybara-600 px-2 py-0.5 rounded-full"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  )
}
