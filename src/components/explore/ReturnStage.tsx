'use client'

import { Confetti } from './FloatingElements'
import type { ExplorationItem } from '@/types'

export default function ReturnStage({
  items,
  capybaraName,
  onComplete,
}: {
  items: ExplorationItem[]
  capybaraName: string
  onComplete: () => void
}) {
  return (
    <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-sky-100 via-meadow-50 to-meadow-100">
      {/* 撒花 */}
      <Confetti />

      {/* 背景装饰 */}
      <div className="absolute bottom-20 left-4 text-xl animate-sway">🌿</div>
      <div className="absolute bottom-24 right-8 text-lg animate-sway" style={{ animationDelay: '0.5s' }}>🌸</div>

      {/* 河流 */}
      <div className="absolute bottom-10 left-0 right-0 text-center text-lg opacity-40 animate-sway">
        ~ ~ ~ 🌊 ~ ~ ~ ~ ~ 🌊 ~ ~ ~
      </div>

      {/* 卡皮巴拉回来了 */}
      <div className="absolute left-1/2 bottom-28 -translate-x-1/2 animate-slide-in-left">
        <span className="text-5xl inline-block">🦫</span>
      </div>

      {/* 欢迎回来 */}
      <div className="absolute top-8 left-0 right-0 text-center">
        <p className="text-2xl font-bold text-capybara-700 animate-pop-in mb-2">
          🎉 {capybaraName}回来了！
        </p>
        <p className="text-sm text-gray-400 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          这次探索带回了 {items.length} 件东西~
        </p>
      </div>

      {/* 收获总结卡片 */}
      <div
        className="absolute top-28 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl p-4 shadow-lg animate-fade-in-up"
        style={{ animationDelay: '0.8s' }}
      >
        <h3 className="text-sm font-semibold text-gray-700 mb-3">本次探索收获</h3>
        <div className="space-y-2 mb-4">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{item.name}</span>
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
                {item.rarity}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onComplete}
          className="w-full py-2.5 bg-capybara-500 text-white rounded-xl text-sm font-medium
                     hover:bg-capybara-600 transition"
        >
          太棒了！
        </button>
      </div>
    </div>
  )
}
