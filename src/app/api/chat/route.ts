import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { callAI, fallbackChat } from '@/lib/ai/client'
import { chatSystemPrompt, chatUserPrompt } from '@/lib/ai/prompts'
import type { ChatResponse } from '@/types'

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

  // 3. 调用 AI（或 fallback）
  let chatResponse: ChatResponse

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
      // 尝试从 AI 回复中提取 JSON
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
      chatResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : fallbackChat(message)
    } catch {
      chatResponse = fallbackChat(message)
    }
  } else {
    chatResponse = fallbackChat(message)
  }

  // 如果卡皮巴拉正在探索，不要想出去
  if (capybara.status !== 'home') {
    chatResponse.want_to_explore = false
  }

  // 4. 保存对话
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

  // 5. 更新卡皮巴拉心情
  await supabase
    .from('capybaras')
    .update({ mood: chatResponse.mood })
    .eq('id', capybara.id)

  // 6. 如果关键词涉及重要记忆，追加到记忆
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
    capybara_status: capybara.status,
  })
}
