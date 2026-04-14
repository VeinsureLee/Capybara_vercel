import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { callAI, fallbackExploration } from '@/lib/ai/client'
import {
  explorationSystemPrompt,
  explorationUserPrompt,
} from '@/lib/ai/prompts'

/**
 * GET /api/explore - 查询当前探索状态（懒完成机制）
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: exploration } = await supabase
    .from('explorations')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!exploration) {
    return NextResponse.json({ exploration: null })
  }

  // 懒完成：到时间了就标记完成
  if (new Date(exploration.estimated_return) <= new Date()) {
    await supabase
      .from('explorations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', exploration.id)

    await supabase
      .from('capybaras')
      .update({ status: 'home' })
      .eq('capybara_id', exploration.capybara_id)
      .eq('owner_id', user.id)

    // 也用 owner_id 做 fallback 更新
    await supabase
      .from('capybaras')
      .update({ status: 'home' })
      .eq('owner_id', user.id)

    return NextResponse.json({
      exploration: {
        ...exploration,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      just_completed: true,
    })
  }

  return NextResponse.json({ exploration })
}

/**
 * POST /api/explore - 发起探索
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. 确认卡皮巴拉在家
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) {
    return NextResponse.json({ error: 'No capybara' }, { status: 404 })
  }
  if (capybara.status !== 'home') {
    return NextResponse.json(
      { error: '卡皮巴拉正在外面，还不能再出发哦' },
      { status: 400 }
    )
  }

  // 2. 聚合最近对话关键词
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('keywords')
    .eq('user_id', user.id)
    .not('keywords', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const keywordWeights: Record<string, number> = {}
  ;(recentConvos || []).forEach((conv, i) => {
    const weight = 1 - i * 0.04
    const kws = conv.keywords as string[]
    kws?.forEach((kw) => {
      keywordWeights[kw] = (keywordWeights[kw] || 0) + weight
    })
  })

  const topKeywords = Object.entries(keywordWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([kw]) => kw)

  if (topKeywords.length === 0) {
    topKeywords.push('散步', '好奇')
  }

  // 3. 决定探索类型
  const rand = Math.random()
  const type: 'short' | 'medium' | 'long' =
    rand < 0.5 ? 'short' : rand < 0.85 ? 'medium' : 'long'

  // 4. 生成探索内容（AI 或 fallback）
  let result: {
    location: { name: string; description: string; theme: string }
    story: string
    items: { name: string; description: string; category: string; rarity: string }[]
    durationHours: number
    type: string
  }

  const system = explorationSystemPrompt()
  const prompt = explorationUserPrompt(
    topKeywords,
    (capybara.traits as string[]).join('、'),
    type
  )
  const aiResult = await callAI(system, prompt)

  if (aiResult) {
    try {
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
      if (parsed?.location && parsed?.story) {
        // MVP：探索时间缩短方便测试（3分钟/6分钟/12分钟）
        const durationMap = { short: 0.05, medium: 0.1, long: 0.2 }
        result = {
          location: parsed.location,
          story: parsed.story,
          items: parsed.items_found || [],
          durationHours: durationMap[type],
          type,
        }
      } else {
        result = fallbackExploration(topKeywords)
      }
    } catch {
      result = fallbackExploration(topKeywords)
    }
  } else {
    result = fallbackExploration(topKeywords)
  }

  // 5. 计算返回时间
  const estimatedReturn = new Date(
    Date.now() + result.durationHours * 60 * 60 * 1000
  ).toISOString()

  // 6. 创建探索记录
  const { data: exploration, error } = await supabase
    .from('explorations')
    .insert({
      capybara_id: capybara.id,
      user_id: user.id,
      status: 'ongoing',
      exploration_type: type,
      trigger_keywords: topKeywords,
      story: result.story,
      items_found: result.items,
      started_at: new Date().toISOString(),
      estimated_return: estimatedReturn,
    })
    .select()
    .single()

  if (error) {
    console.error('Create exploration error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 7. 更新卡皮巴拉状态
  await supabase
    .from('capybaras')
    .update({ status: 'exploring' })
    .eq('id', capybara.id)

  return NextResponse.json({
    exploration,
    location: result.location,
    type,
    estimated_return: estimatedReturn,
    departure_message: `${capybara.name}背起小包出发啦~ 目的地：${result.location.name}`,
  })
}
