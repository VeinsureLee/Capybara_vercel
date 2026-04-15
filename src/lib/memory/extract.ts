/**
 * V2 记忆提取系统
 * 从对话中识别有记忆价值的内容，AI 分档 shareable/private
 */
import { callAI } from '@/lib/ai/client'
import type { MemoryClassification } from '@/types'

/**
 * 记忆分类 prompt
 * 输入：一段用户对话内容
 * 输出：结构化的记忆分类 JSON（或 null 表示无记忆价值）
 */
export function memoryClassifyPrompt(userMessage: string, recentContext: string): string {
  return `你是卡皮巴拉的记忆助手。你的任务是判断这段对话是否包含值得记住的记忆。

用户刚才说的话：
"${userMessage}"

最近对话上下文：
${recentContext}

判断标准：
- 值得记住的：偏好/兴趣、情绪状态、生活经历/回忆、对某事的态度、生活方式描述
- 不值得记住的：打招呼、问天气、闲聊、对卡皮的指令、重复内容

如果这段话包含值得记住的内容，输出 JSON：
{
  "has_memory": true,
  "topic": "一个简短的主题标签（如"童年回忆"、"失去宠物"、"喜欢下雨天"）",
  "summary": "用第三人称一句话概括这段记忆（20-40字）",
  "emotion": "这段记忆的主要情感（开心/难过/怀念/焦虑/平静/感恩/孤独）",
  "shareable": true或false,
  "sensitive_category": null或具体类别
}

shareable 判断规则（宁可多判 false）：
- false（私密）：涉及家人具体信息、健康/疾病、财务、法律、亲密关系细节、未成年人
- true（可分享）：兴趣偏好、一般情绪、童年经历主题、生活方式、对事物的态度

sensitive_category：
- 如涉及自杀/自伤 → "crisis"
- 如涉及家人具体信息 → "family_detail"
- 如涉及健康/疾病 → "health"
- 如涉及财务 → "finance"
- 其他不敏感 → null

如果这段话不包含值得记住的内容，输出：
{ "has_memory": false }

只输出 JSON，不要有其他内容。`
}

/**
 * 从用户消息中提取记忆
 * @returns 记忆分类结果，或 null（无记忆价值）
 */
export async function extractMemory(
  userMessage: string,
  recentConversations: { role: string; content: string }[]
): Promise<MemoryClassification | null> {
  const recentContext = recentConversations
    .slice(-6)
    .map((c) => `${c.role === 'user' ? '人类' : '卡皮'}：${c.content}`)
    .join('\n')

  const prompt = memoryClassifyPrompt(userMessage, recentContext)
  const result = await callAI(
    '你是一个记忆分类助手，只输出 JSON。',
    prompt
  )

  if (!result) return null

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.has_memory) return null

    return {
      topic: parsed.topic,
      summary: parsed.summary,
      emotion: parsed.emotion ?? 'calm',
      shareable: parsed.shareable ?? false,
      sensitive_category: parsed.sensitive_category ?? null,
    }
  } catch {
    return null
  }
}

/**
 * 将卡皮的记忆意愿用自然语言表达
 * （V2 设计：后台分档 = 卡皮的自然表达）
 */
export function memoryReactionText(classification: MemoryClassification): string {
  if (!classification.shareable) {
    const privateReactions = [
      '这个就我们俩知道就好',
      '嗯…这个我不跟别人说',
      '我记住了，放心',
      '*认真地点了点头*',
    ]
    return privateReactions[Math.floor(Math.random() * privateReactions.length)]
  }

  const shareableReactions = [
    '这件事挺有意思的，我想记着',
    '嗯，这个我记住了',
    '哦…*嚼嚼* 挺好玩的',
    '*竖了竖耳朵* 记下了',
  ]
  return shareableReactions[Math.floor(Math.random() * shareableReactions.length)]
}
