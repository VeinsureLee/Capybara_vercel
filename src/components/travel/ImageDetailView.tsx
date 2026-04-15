'use client'

import { useState } from 'react'
import type { VisualHighlight } from '@/types'

interface AnnotatedHighlight extends VisualHighlight {
  journalId: string
  dayNumber: number
}

interface ImageDetailViewProps {
  imageUrl: string
  locationName: string
  region: string
  highlights: AnnotatedHighlight[]
  onClose: () => void
}

/** 将 suggested_position 转换为 CSS 百分比坐标 */
function positionToCoords(pos: string): { x: number; y: number } {
  const map: Record<string, { x: number; y: number }> = {
    'top-left': { x: 15, y: 20 },
    'top-center': { x: 50, y: 15 },
    'top-right': { x: 85, y: 20 },
    'left-center': { x: 12, y: 50 },
    'center': { x: 50, y: 50 },
    'right-center': { x: 88, y: 50 },
    'bottom-left': { x: 15, y: 80 },
    'bottom-center': { x: 50, y: 85 },
    'bottom-right': { x: 85, y: 80 },
  }
  return map[pos] ?? { x: 50, y: 50 }
}

export default function ImageDetailView({
  imageUrl,
  locationName,
  region,
  highlights,
  onClose,
}: ImageDetailViewProps) {
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [activeHighlight, setActiveHighlight] = useState<number | null>(null)

  // 限制最多 5 个标注
  const displayHighlights = highlights.slice(0, 5)

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <button onClick={onClose} className="text-white/80 text-sm hover:text-white">
          ← 返回
        </button>
        <h2 className="text-white text-sm font-medium truncate mx-4">{locationName}</h2>
        <button
          onClick={() => setShowAnnotations(!showAnnotations)}
          className={`text-xs px-3 py-1 rounded-full transition ${
            showAnnotations
              ? 'bg-white/20 text-white'
              : 'bg-white/10 text-white/50'
          }`}
        >
          {showAnnotations ? '隐藏标注' : '显示标注'}
        </button>
      </div>

      {/* 大图区域 + 标注 */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* 图片 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={locationName}
          className="max-w-full max-h-full object-contain"
        />

        {/* 标注层 */}
        {showAnnotations && displayHighlights.length > 0 && (
          <div className="absolute inset-0">
            {displayHighlights.map((h, i) => {
              const coords = positionToCoords(h.suggested_position)
              const isActive = activeHighlight === i

              return (
                <div key={i} className="absolute" style={{ left: `${coords.x}%`, top: `${coords.y}%` }}>
                  {/* 标注圆点 */}
                  <button
                    onClick={() => setActiveHighlight(isActive ? null : i)}
                    className={`relative w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all ${
                      isActive
                        ? 'bg-white border-capybara-500 scale-125'
                        : 'bg-white/80 border-white hover:scale-110'
                    }`}
                  >
                    <span className="absolute inset-0 rounded-full bg-capybara-400 animate-ping opacity-30" />
                    <span className="absolute inset-1 rounded-full bg-capybara-500" />
                  </button>

                  {/* 对话框（展开时显示） */}
                  {isActive && (
                    <div
                      className="absolute z-10 animate-fade-in"
                      style={{
                        // 根据位置决定对话框方向
                        ...(coords.x > 50
                          ? { right: '100%', marginRight: '8px' }
                          : { left: '100%', marginLeft: '8px' }),
                        top: '-8px',
                      }}
                    >
                      {/* 连接线 */}
                      <div
                        className="absolute top-4 w-2 h-px bg-white/60"
                        style={coords.x > 50 ? { right: '-8px' } : { left: '-8px' }}
                      />
                      {/* 卡片 */}
                      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 min-w-[140px] max-w-[200px]">
                        <p className="text-xs font-semibold text-gray-800">{h.keyword}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                          {h.description}
                        </p>
                        <p className="text-[10px] text-capybara-500 mt-1">
                          第 {h.dayNumber} 天手记
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      <div className="px-4 py-3 bg-black/50">
        <p className="text-white/80 text-sm">{locationName}</p>
        <p className="text-white/40 text-xs">{region}</p>
        {displayHighlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {displayHighlights.map((h, i) => (
              <button
                key={i}
                onClick={() => setActiveHighlight(activeHighlight === i ? null : i)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full transition ${
                  activeHighlight === i
                    ? 'bg-capybara-500 text-white'
                    : 'bg-white/15 text-white/70 hover:bg-white/25'
                }`}
              >
                📌 {h.keyword}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
