'use client'

import { useEffect, useState } from 'react'
import { MS_PER_DAY } from '@/lib/travel/timeConfig'

interface ContinuousProgressProps {
  startedAt: string
  estimatedReturn: string
  durationDays: number
}

export default function ContinuousProgress({
  startedAt,
  estimatedReturn,
  durationDays,
}: ContinuousProgressProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const startMs = new Date(startedAt).getTime()
  const returnMs = new Date(estimatedReturn).getTime()
  const totalMs = returnMs - startMs
  const elapsedMs = now - startMs
  const progress = Math.min(Math.max(elapsedMs / totalMs, 0), 1)
  const remainingMs = Math.max(returnMs - now, 0)

  const currentDay = Math.min(
    Math.floor((now - startMs) / MS_PER_DAY) + 1,
    durationDays
  )

  // 格式化剩余时间
  function formatRemaining(ms: number): string {
    if (ms <= 0) return '即将返回'
    const totalSec = Math.ceil(ms / 1000)
    if (totalSec < 60) return `${totalSec} 秒`
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    if (min < 60) return sec > 0 ? `${min} 分 ${sec} 秒` : `${min} 分钟`
    const hr = Math.floor(min / 60)
    const remMin = min % 60
    if (hr < 24) return remMin > 0 ? `${hr} 小时 ${remMin} 分` : `${hr} 小时`
    const d = Math.floor(hr / 24)
    const remHr = hr % 24
    return remHr > 0 ? `${d} 天 ${remHr} 小时` : `${d} 天`
  }

  // 计算天数刻度位置
  const dayMarkers = Array.from({ length: durationDays + 1 }, (_, i) => ({
    position: i / durationDays,
    label: i === 0 ? '出发' : i === durationDays ? '到达' : `第${i}天`,
  }))

  return (
    <div className="space-y-1.5">
      {/* 进度条 */}
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-capybara-400 to-capybara-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
        {/* 天数刻度线 */}
        {dayMarkers.slice(1, -1).map((m, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-white/60"
            style={{ left: `${m.position * 100}%` }}
          />
        ))}
        {/* 当前位置指示器 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-capybara-500 rounded-full shadow-sm transition-all duration-1000 ease-linear"
          style={{ left: `calc(${progress * 100}% - 7px)` }}
        />
      </div>

      {/* 刻度标签 */}
      <div className="relative h-4">
        {dayMarkers.map((m, i) => (
          <span
            key={i}
            className={`absolute text-[10px] -translate-x-1/2 ${
              m.position <= progress ? 'text-capybara-600' : 'text-gray-300'
            }`}
            style={{ left: `${Math.min(Math.max(m.position * 100, 5), 95)}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* 进度文字 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          第 {currentDay} / {durationDays} 天
        </p>
        <p className="text-xs text-gray-400">
          {formatRemaining(remainingMs)}后回来
        </p>
      </div>
    </div>
  )
}
