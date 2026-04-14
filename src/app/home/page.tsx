'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import type { Capybara, Exploration, ExplorationItem } from '@/types'

export default function HomePage() {
  const [capybara, setCapybara] = useState<Capybara | null>(null)
  const [recentExplorations, setRecentExplorations] = useState<Exploration[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

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
          </p>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 收集的物品 */}
        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            📦 收集的物品 ({allItems.length})
          </h3>
          {allItems.length === 0 ? (
            <div className="text-center py-8 text-gray-300 text-sm">
              还没有物品，和{capybara?.name || '卡皮'}聊聊天让它去探索吧~
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {allItems.map((item, i) => (
                <div
                  key={i}
                  className="p-3 bg-white rounded-xl shadow-sm border border-gray-50"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">
                      {item.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        rarityColor[item.rarity] || rarityColor.common
                      }`}
                    >
                      {rarityLabel[item.rarity] || '普通'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 探索日志 */}
        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            📖 探索日志
          </h3>
          {recentExplorations.length === 0 ? (
            <div className="text-center py-6 text-gray-300 text-sm">
              暂无探索记录
            </div>
          ) : (
            <div className="space-y-2">
              {recentExplorations.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3 bg-white rounded-xl shadow-sm border border-gray-50"
                >
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {exp.story}
                  </p>
                  <p className="text-[10px] text-gray-300 mt-2">
                    {exp.completed_at
                      ? new Date(exp.completed_at).toLocaleString('zh-CN')
                      : ''}
                  </p>
                </div>
              ))}
            </div>
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
