'use client'

const stages = [
  { key: 'departure', label: '出发', icon: '🎒', threshold: 0 },
  { key: 'journey', label: '途中', icon: '🚶', threshold: 25 },
  { key: 'discovery', label: '发现', icon: '✨', threshold: 75 },
  { key: 'return', label: '归来', icon: '🏠', threshold: 95 },
]

export default function ProgressBar({
  progress,
  stage,
}: {
  progress: number
  stage: string
}) {
  return (
    <div className="px-4 py-3 bg-white/80 backdrop-blur">
      {/* 节点 + 进度条 */}
      <div className="relative flex items-center justify-between mb-1.5">
        {/* 背景轨道 */}
        <div className="absolute left-2 right-2 h-1 bg-gray-200 rounded-full top-1/2 -translate-y-1/2" />
        {/* 已完成轨道 */}
        <div
          className="absolute left-2 h-1 bg-gradient-to-r from-meadow-400 via-river-400 to-capybara-400 rounded-full top-1/2 -translate-y-1/2 transition-all duration-1000"
          style={{ width: `${Math.min(96, progress)}%` }}
        />

        {stages.map((s) => {
          const isPast = progress >= s.threshold
          const isCurrent = stage === s.key
          return (
            <div key={s.key} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm
                  ${isCurrent
                    ? 'bg-capybara-500 shadow-md shadow-capybara-200 animate-pulse'
                    : isPast
                      ? 'bg-meadow-500'
                      : 'bg-gray-200'
                  }`}
              >
                {s.icon}
              </div>
            </div>
          )
        })}
      </div>

      {/* 标签 */}
      <div className="flex justify-between px-0.5">
        {stages.map((s) => (
          <span
            key={s.key}
            className={`text-[10px] w-7 text-center ${
              stage === s.key ? 'text-capybara-600 font-semibold' : 'text-gray-400'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
