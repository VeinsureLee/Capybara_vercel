'use client'

import { useEffect, useRef, useState } from 'react'
import type { MapLocation } from './WorldMap'

interface LocationDetailProps {
  location: MapLocation | null
  onClose: () => void
  onStartTravel: () => void
  canTravel: boolean
  starting: boolean
}

export default function LocationDetail({
  location,
  onClose,
  onStartTravel,
  canTravel,
  starting,
}: LocationDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    setImageLoaded(false)
  }, [location?.name])

  // 点击面板外关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (location) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [location, onClose])

  if (!location) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up overflow-hidden"
        style={{ maxHeight: '75vh' }}
      >
        {/* 拖拽指示条 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 地点照片 */}
        <div className="relative h-48 mx-4 rounded-2xl overflow-hidden bg-gray-100">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-capybara-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={location.image}
            alt={location.name}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />
          {/* 卡皮正在探索标记 */}
          {location.isActive && (
            <div className="absolute top-3 right-3 bg-capybara-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
              <span>🦫</span>
              <span>正在探索</span>
            </div>
          )}
        </div>

        {/* 地点信息 */}
        <div className="px-5 pt-4 pb-6">
          <h2 className="text-lg font-bold text-gray-800">{location.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{location.region}</p>

          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            {location.description}
          </p>

          {/* 标签 */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {location.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-0.5 bg-river-50 text-river-600 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="mt-5 flex gap-3">
            {canTravel && !location.isActive && (
              <button
                onClick={onStartTravel}
                disabled={starting}
                className="flex-1 py-3 bg-capybara-500 text-white rounded-xl text-sm font-medium
                           hover:bg-capybara-600 transition disabled:opacity-40"
              >
                {starting ? '出发中...' : `让卡皮去${location.name.split('·')[0]}看看`}
              </button>
            )}
            {location.isActive && (
              <div className="flex-1 py-3 bg-meadow-50 text-meadow-700 rounded-xl text-sm font-medium text-center">
                卡皮正在这里旅行中~
              </div>
            )}
            <button
              onClick={onClose}
              className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl text-sm hover:bg-gray-200 transition"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
