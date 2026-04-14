'use client'

import { useState, useEffect } from 'react'
import DepartureStage from './DepartureStage'
import JourneyStage from './JourneyStage'
import DiscoveryStage from './DiscoveryStage'
import ReturnStage from './ReturnStage'
import ProgressBar from './ProgressBar'
import type { Exploration, ExplorationItem } from '@/types'

type Stage = 'departure' | 'journey' | 'discovery' | 'return'

function calcProgress(exploration: Exploration): { progress: number; stage: Stage } {
  const start = new Date(exploration.started_at).getTime()
  const end = new Date(exploration.estimated_return).getTime()
  const now = Date.now()
  const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))

  let stage: Stage
  if (progress < 25) stage = 'departure'
  else if (progress < 75) stage = 'journey'
  else if (progress < 95) stage = 'discovery'
  else stage = 'return'

  return { progress, stage }
}

export default function ExploreScene({
  exploration,
  capybaraName,
  onComplete,
}: {
  exploration: Exploration
  capybaraName: string
  onComplete: () => void
}) {
  const [state, setState] = useState(() => calcProgress(exploration))

  // 每秒更新进度
  useEffect(() => {
    const interval = setInterval(() => {
      setState(calcProgress(exploration))
    }, 1000)
    return () => clearInterval(interval)
  }, [exploration])

  const items = (exploration.items_found || []) as ExplorationItem[]
  const theme = exploration.trigger_keywords?.[0] || '自然'

  // 从 trigger_keywords 推测主题
  const themeKeywords: Record<string, string[]> = {
    神秘: ['神秘', '月', '夜', '星空', '梦'],
    怀旧: ['怀旧', '回忆', '小时候', '过去'],
    梦幻: ['梦幻', '梦', '幻想', '美丽', '花'],
    冒险: ['冒险', '探索', '远方', '挑战', '勇敢'],
  }

  let detectedTheme = '自然'
  const keywords = exploration.trigger_keywords || []
  for (const [t, kws] of Object.entries(themeKeywords)) {
    if (keywords.some((kw) => kws.some((tkw) => kw.includes(tkw)))) {
      detectedTheme = t
      break
    }
  }

  // 计算剩余时间
  const remainMs = Math.max(0, new Date(exploration.estimated_return).getTime() - Date.now())
  const remainMin = Math.floor(remainMs / 60000)
  const remainSec = Math.floor((remainMs % 60000) / 1000)
  const remainText = `${remainMin}:${remainSec.toString().padStart(2, '0')}`

  return (
    <div className="flex flex-col h-full">
      {/* 倒计时 */}
      <div className="text-center py-2 bg-white/60 backdrop-blur text-xs text-gray-400">
        {state.progress >= 100
          ? '探索完成！'
          : `预计 ${remainText} 后归来`}
      </div>

      {/* 场景区域 */}
      <div className="flex-1 relative">
        {state.stage === 'departure' && (
          <DepartureStage
            capybaraName={capybaraName}
            locationName={exploration.story?.slice(0, 20) || '未知之地'}
            progress={state.progress}
          />
        )}
        {state.stage === 'journey' && (
          <JourneyStage
            theme={detectedTheme}
            story={exploration.story}
            capybaraName={capybaraName}
          />
        )}
        {state.stage === 'discovery' && (
          <DiscoveryStage items={items} capybaraName={capybaraName} />
        )}
        {state.stage === 'return' && (
          <ReturnStage
            items={items}
            capybaraName={capybaraName}
            onComplete={onComplete}
          />
        )}
      </div>

      {/* 进度条 */}
      <ProgressBar progress={state.progress} stage={state.stage} />
    </div>
  )
}
