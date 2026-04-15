import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { callAI, fallbackChat } from '@/lib/ai/client'
import { chatSystemPrompt, chatUserPrompt, chatSystemPromptV2 } from '@/lib/ai/prompts'
import { extractMemory, memoryReactionText } from '@/lib/memory/extract'
import { MS_PER_DAY } from '@/lib/travel/timeConfig'
import type { ChatResponse, ChatResponseV2 } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const message = body.message as string
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // 1. 获取卡皮巴拉
  const { data: capybara } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!capybara) {
    return NextResponse.json({ error: 'No capybara' }, { status: 404 })
  }

  // 2. 获取最近对话
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const conversations = (recentConvos || []).reverse()

  // 3. 判断使用 V1 还是 V2 prompt
  const isV2Status = capybara.status === 'traveling' || capybara.status === 'resting'
  let chatResponse: ChatResponse
  let v2Response: ChatResponseV2 | null = null

  if (isV2Status || capybara.status === 'home') {
    // V2 路径：支持 traveling/resting/home
    let travelLocation: string | undefined
    let travelDay: number | undefined

    if (capybara.status === 'traveling') {
      const { data: activeTravel } = await supabase
        .from('travels')
        .select('*, travel_locations(name)')
        .eq('user_id', user.id)
        .eq('status', 'traveling')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (activeTravel) {
        const loc = activeTravel.travel_locations as { name: string } | null
        travelLocation = loc?.name
        const startDate = new Date(activeTravel.started_at)
        travelDay = Math.floor((Date.now() - startDate.getTime()) / MS_PER_DAY) + 1
      }
    }

    const v2Status = (capybara.status === 'exploring' || capybara.status === 'visiting')
      ? 'home' as const
      : capybara.status as 'home' | 'traveling' | 'resting'

    const system = chatSystemPromptV2({
      name: capybara.name,
      traits: capybara.traits as string[],
      mood: capybara.mood,
      status: v2Status,
      memory: (capybara.memory as string[]) || [],
      travelLocation,
      travelDay,
    })

    const prompt = chatUserPrompt(conversations, message)
    const aiResult = await callAI(system, prompt)

    if (aiResult) {
      try {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          chatResponse = {
            reply: parsed.reply,
            mood: parsed.mood,
            keywords: parsed.keywords ?? [],
            want_to_explore: parsed.want_to_travel ?? false,
          }
          v2Response = {
            reply: parsed.reply,
            mood: parsed.mood,
            keywords: parsed.keywords ?? [],
            want_to_travel: parsed.want_to_travel ?? false,
          }
        } else {
          chatResponse = fallbackChat(message)
        }
      } catch {
        chatResponse = fallbackChat(message)
      }
    } else {
      chatResponse = fallbackChat(message)
    }
  } else {
    // V1 路径：exploring/visiting
    const system = chatSystemPrompt({
      name: capybara.name,
      traits: capybara.traits as string[],
      mood: capybara.mood,
      status: capybara.status as 'home' | 'exploring' | 'visiting',
      memory: (capybara.memory as string[]) || [],
    })

    const prompt = chatUserPrompt(conversations, message)
    const aiResult = await callAI(system, prompt)

    if (aiResult) {
      try {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
        chatResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : fallbackChat(message)
      } catch {
        chatResponse = fallbackChat(message)
      }
    } else {
      chatResponse = fallbackChat(message)
    }
  }

  // 如果卡皮巴拉不在家，不要想出去
  if (capybara.status !== 'home') {
    chatResponse.want_to_explore = false
  }

  // 4. V2 记忆提取（异步，不阻塞响应）
  let memoryReaction: string | null = null
  try {
    const memoryResult = await extractMemory(message, conversations)
    if (memoryResult) {
      memoryReaction = memoryReactionText(memoryResult)

      // 写入 memories 表
      await supabase.from('memories').insert({
        user_id: user.id,
        capybara_id: capybara.id,
        topic: memoryResult.topic,
        summary: memoryResult.summary,
        emotion: memoryResult.emotion,
        shareable: memoryResult.shareable,
        sensitive_category: memoryResult.sensitive_category,
      })

      if (v2Response) {
        v2Response.memory_reaction = memoryReaction
        v2Response.memory_extract = memoryResult
      }
    }
  } catch (err) {
    console.error('[Memory] extraction failed:', err)
  }

  // 5. 保存对话
  await supabase.from('conversations').insert([
    {
      user_id: user.id,
      capybara_id: capybara.id,
      role: 'user',
      content: message,
      keywords: chatResponse.keywords,
    },
    {
      user_id: user.id,
      capybara_id: capybara.id,
      role: 'capybara',
      content: chatResponse.reply,
      mood: chatResponse.mood,
    },
  ])

  // 6. 更新卡皮巴拉心情
  await supabase
    .from('capybaras')
    .update({ mood: chatResponse.mood })
    .eq('id', capybara.id)

  // 7. V1 关键词记忆（保留兼容）
  const memory = (capybara.memory as string[]) || []
  const importantKeywords = chatResponse.keywords.filter(
    (kw) => !['散步', '好奇', '问候', '介绍'].includes(kw)
  )
  if (importantKeywords.length > 0 && memory.length < 20) {
    const newMemory = `主人聊到了${importantKeywords.join('和')}`
    if (!memory.includes(newMemory)) {
      await supabase
        .from('capybaras')
        .update({ memory: [...memory, newMemory] })
        .eq('id', capybara.id)
    }
  }

  return NextResponse.json({
    reply: chatResponse.reply,
    mood: chatResponse.mood,
    keywords: chatResponse.keywords,
    want_to_explore: chatResponse.want_to_explore,
    want_to_travel: v2Response?.want_to_travel ?? false,
    memory_reaction: memoryReaction,
    capybara_status: capybara.status,
  })
}
