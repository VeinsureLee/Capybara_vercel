'use client'

import { useState, memo } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'

export interface MapLocation {
  name: string
  region: string
  tags: string[]
  description: string
  lat: number
  lng: number
  image: string
  isActive: boolean
}

interface WorldMapProps {
  locations: MapLocation[]
  onSelectLocation: (loc: MapLocation) => void
  activeLocationName: string | null
}

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// 区域颜色映射
const REGION_COLORS: Record<string, string> = {
  '中国': '#F59E0B',
  '日本': '#EC4899',
  '泰国': '#10B981',
  '印尼': '#10B981',
  '柬埔寨': '#10B981',
  '越南': '#10B981',
  '马来西亚': '#10B981',
  '捷克': '#6366F1',
  '希腊': '#6366F1',
  '瑞士': '#6366F1',
  '法国': '#6366F1',
  '冰岛': '#6366F1',
  '挪威': '#6366F1',
  '意大利': '#6366F1',
  '摩洛哥': '#F97316',
  '土耳其': '#F97316',
  '新西兰': '#8B5CF6',
  '尼泊尔': '#F97316',
  '马达加斯加': '#F97316',
  '肯尼亚': '#F97316',
  '加拿大': '#3B82F6',
  '美国': '#3B82F6',
}

function getMarkerColor(region: string): string {
  const key = region.split('·')[0]
  return REGION_COLORS[key] || '#6B7280'
}

function WorldMap({ locations, onSelectLocation, activeLocationName }: WorldMapProps) {
  const [hoveredName, setHoveredName] = useState<string | null>(null)

  return (
    <div className="w-full bg-gradient-to-b from-river-50 to-white rounded-2xl overflow-hidden border border-river-100 shadow-sm">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120, center: [60, 20] }}
        style={{ width: '100%', height: 'auto' }}
        viewBox="0 0 800 450"
      >
        <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rpiKey || geo.properties?.name || Math.random()}
                  geography={geo}
                  fill="#E5E7EB"
                  stroke="#D1D5DB"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#D1D5DB', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {locations.map((loc) => {
            const isActive = loc.name === activeLocationName
            const isHovered = loc.name === hoveredName
            const color = getMarkerColor(loc.region)

            return (
              <Marker
                key={loc.name}
                coordinates={[loc.lng, loc.lat]}
                onClick={() => onSelectLocation(loc)}
                onMouseEnter={() => setHoveredName(loc.name)}
                onMouseLeave={() => setHoveredName(null)}
              >
                {/* 活跃地点的呼吸动画圆圈 */}
                {isActive && (
                  <circle
                    r={8}
                    fill={color}
                    opacity={0.3}
                    className="animate-ping"
                  />
                )}
                {/* 主圆点 */}
                <circle
                  r={isActive ? 5 : isHovered ? 4.5 : 3}
                  fill={isActive ? color : isHovered ? color : `${color}99`}
                  stroke="#fff"
                  strokeWidth={isActive ? 2 : 1}
                  className="cursor-pointer transition-all duration-200"
                />
                {/* 卡皮图标 */}
                {isActive && (
                  <text
                    textAnchor="middle"
                    y={-12}
                    className="text-[10px] select-none pointer-events-none"
                  >
                    🦫
                  </text>
                )}
                {/* Hover 时显示名字 */}
                {isHovered && !isActive && (
                  <text
                    textAnchor="middle"
                    y={-10}
                    className="text-[6px] fill-gray-600 font-medium select-none pointer-events-none"
                  >
                    {loc.name.split('·')[0]}
                  </text>
                )}
              </Marker>
            )
          })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}

export default memo(WorldMap)
