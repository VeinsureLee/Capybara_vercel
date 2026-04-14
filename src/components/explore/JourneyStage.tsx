'use client'

import { useState, useEffect } from 'react'
import { FloatingElements, GroundElements } from './FloatingElements'

const themeConfig: Record<
  string,
  {
    bg: string
    floatFar: string[]
    floatNear: string[]
    ground: string[]
  }
> = {
  自然: {
    bg: 'from-sky-100 via-green-50 to-green-100',
    floatFar: ['☁️', '☁️', '🦋', '☁️'],
    floatNear: ['🍃', '🌿', '🍀', '🍃'],
    ground: ['🌺', '🌼', '🌿', '🌻', '🌸'],
  },
  神秘: {
    bg: 'from-indigo-100 via-purple-50 to-purple-100',
    floatFar: ['✨', '🌙', '💫', '✨'],
    floatNear: ['🦋', '🌟', '💜', '🦋'],
    ground: ['🍄', '🔮', '🌑', '🍄', '🌿'],
  },
  怀旧: {
    bg: 'from-amber-100 via-orange-50 to-amber-100',
    floatFar: ['☁️', '🕊️', '☁️', '🍂'],
    floatNear: ['🍂', '🍁', '🍂', '🍃'],
    ground: ['🏮', '🌾', '🪨', '🎐', '🌾'],
  },
  梦幻: {
    bg: 'from-pink-100 via-purple-50 to-blue-100',
    floatFar: ['⭐', '🌙', '💫', '⭐'],
    floatNear: ['🌈', '💭', '🌟', '✨'],
    ground: ['🌸', '🎀', '🌷', '💮', '🌸'],
  },
  冒险: {
    bg: 'from-gray-200 via-green-100 to-green-200',
    floatFar: ['🦅', '☁️', '💨', '☁️'],
    floatNear: ['🍃', '💨', '🌿', '🍃'],
    ground: ['⛰️', '🪨', '🌲', '🪨', '🌵'],
  },
}

const defaultJourneyMessages = [
  '在路上看到了好多有趣的东西~',
  '这里的风好舒服呀，嘿嘿',
  '闻到了一股好闻的味道，是花香吗？',
  '遇到了一只小蝴蝶，它在带路呢！',
  '脚下的路变了，好像快到了...',
  '好安静呀，只有风和虫鸣的声音',
]

export default function JourneyStage({
  theme,
  story,
  capybaraName,
}: {
  theme: string
  story?: string
  capybaraName: string
}) {
  const config = themeConfig[theme] || themeConfig['自然']
  const [messageIndex, setMessageIndex] = useState(0)

  // 从 story 切分 或 使用默认消息
  const messages = story
    ? story
        .replace(/[。！？~]/g, (m) => m + '|')
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 6)
    : defaultJourneyMessages

  // 定时切换见闻文字
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [messages.length])

  return (
    <div className={`relative flex-1 overflow-hidden bg-gradient-to-b ${config.bg}`}>
      {/* 远景飘浮物 */}
      <FloatingElements items={config.floatFar} speed="slow" layer="far" />

      {/* 近景飘浮物 */}
      <FloatingElements items={config.floatNear} speed="normal" layer="near" />

      {/* 地面滚动 */}
      <GroundElements items={config.ground} />

      {/* 卡皮巴拉走路 */}
      <div className="absolute left-1/3 bottom-28 -translate-x-1/2">
        <div className="relative">
          <span className="text-5xl animate-walk inline-block">🦫</span>
          <span className="absolute -top-2 -right-2 text-lg animate-walk inline-block" style={{ animationDelay: '0.1s' }}>🎒</span>
        </div>
      </div>

      {/* 见闻气泡 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64">
        <div
          key={messageIndex}
          className="bg-white/90 backdrop-blur rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm animate-fade-in-up"
        >
          <p className="text-sm text-gray-700">
            <span className="text-xs text-gray-400 mr-1">🦫 {capybaraName}:</span>
            <br />
            {messages[messageIndex]}
          </p>
        </div>
      </div>

      {/* 地面线 */}
      <div className="absolute bottom-14 left-0 right-0 border-t border-dashed border-gray-300/40" />
    </div>
  )
}
