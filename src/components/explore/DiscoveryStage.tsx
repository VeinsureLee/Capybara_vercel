'use client'

import { useState, useEffect } from 'react'
import type { ExplorationItem } from '@/types'

const rarityStyle: Record<string, { border: string; glow: string; label: string }> = {
  common: { border: 'border-gray-200', glow: '', label: '普通' },
  uncommon: { border: 'border-green-300', glow: 'shadow-green-200/50 shadow-md', label: '不常见' },
  rare: { border: 'border-blue-400', glow: 'shadow-blue-300/60 shadow-lg animate-glow-pulse', label: '稀有' },
  legendary: { border: 'border-purple-400', glow: 'shadow-purple-400/70 shadow-xl animate-glow-pulse', label: '传说' },
}

export default function DiscoveryStage({
  items,
  capybaraName,
}: {
  items: ExplorationItem[]
  capybaraName: string
}) {
  const [revealedCount, setRevealedCount] = useState(0)

  // 逐个展示物品
  useEffect(() => {
    if (revealedCount >= items.length) return
    const timer = setTimeout(
      () => setRevealedCount((c) => c + 1),
      revealedCount === 0 ? 800 : 1500
    )
    return () => clearTimeout(timer)
  }, [revealedCount, items.length])

  const categoryEmoji: Record<string, string> = {
    decoration: '🎨',
    plant: '🌱',
    collectible: '💎',
    interactive: '🔧',
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-amber-50 via-yellow-50 to-orange-50">
      {/* 闪光背景 */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className="absolute text-xl animate-sparkle"
            style={{
              top: `${15 + (i * 23) % 50}%`,
              left: `${10 + (i * 31) % 80}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          >
            ✨
          </span>
        ))}
      </div>

      {/* 卡皮巴拉惊喜 */}
      <div className="absolute left-1/2 bottom-28 -translate-x-1/2">
        <div className="relative">
          <span className="text-5xl inline-block animate-surprise">🦫</span>
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-pop-in font-bold text-amber-500">
            !
          </span>
        </div>
      </div>

      {/* 发现的物品 */}
      <div className="absolute top-10 left-0 right-0 flex flex-col items-center gap-3 px-4">
        <p className="text-capybara-700 font-semibold mb-2 animate-fade-in-up">
          {capybaraName}发现了好东西！
        </p>

        {items.slice(0, revealedCount).map((item, i) => {
          const style = rarityStyle[item.rarity] || rarityStyle.common
          return (
            <div
              key={i}
              className={`w-64 bg-white rounded-xl p-3 border ${style.border} ${style.glow} animate-pop-in`}
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-800 text-sm">
                  {categoryEmoji[item.category] || '📦'} {item.name}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    item.rarity === 'legendary'
                      ? 'bg-purple-100 text-purple-700'
                      : item.rarity === 'rare'
                        ? 'bg-blue-100 text-blue-700'
                        : item.rarity === 'uncommon'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {style.label}
                </span>
              </div>
              <p className="text-xs text-gray-400">{item.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
