'use client'

import { FloatingElements } from './FloatingElements'

export default function DepartureStage({
  capybaraName,
  locationName,
  progress,
}: {
  capybaraName: string
  locationName: string
  progress: number
}) {
  // 出发阶段 0-25%，映射到移动距离 0-100%
  const movePercent = Math.min(100, (progress / 25) * 100)

  return (
    <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-sky-100 via-meadow-50 to-meadow-100">
      {/* 天空 - 云朵 */}
      <FloatingElements items={['☁️', '☁️', '⛅']} speed="slow" layer="far" />

      {/* 太阳 */}
      <div className="absolute top-6 right-8 text-3xl">🌤️</div>

      {/* 背景草地装饰 */}
      <div className="absolute bottom-20 left-4 text-xl animate-sway">🌿</div>
      <div className="absolute bottom-24 right-12 text-lg animate-sway" style={{ animationDelay: '0.5s' }}>🌸</div>
      <div className="absolute bottom-20 right-6 text-xl animate-sway" style={{ animationDelay: '1s' }}>🌿</div>

      {/* 卡皮巴拉 */}
      <div
        className="absolute bottom-24 transition-all duration-[2000ms] ease-in-out"
        style={{
          left: `${Math.min(85, 30 + movePercent * 0.55)}%`,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="relative">
          <span className="text-5xl animate-walk inline-block">🦫</span>
          <span className="absolute -top-2 -right-2 text-lg">🎒</span>
        </div>
      </div>

      {/* 河流 */}
      <div className="absolute bottom-10 left-0 right-0 text-center text-lg opacity-40 animate-sway">
        ~ ~ ~ 🌊 ~ ~ ~ ~ ~ 🌊 ~ ~ ~
      </div>

      {/* 文字 */}
      <div className="absolute bottom-32 left-0 right-0 text-center animate-fade-in-up">
        <p className="text-capybara-700 font-semibold text-lg mb-1">
          🎒 {capybaraName}背起小包出发啦~
        </p>
        <p className="text-gray-400 text-sm">
          目的地：{locationName}
        </p>
      </div>
    </div>
  )
}
