import type { ChatResponse } from '@/types'

// ============================================
// 多模型 AI 客户端 (DeepSeek → Claude → OpenAI → 本地模板)
// ============================================

interface AIProvider {
  name: string
  available: () => boolean
  call: (system: string, prompt: string) => Promise<string>
}

const providers: AIProvider[] = [
  {
    name: 'deepseek',
    available: () => !!process.env.DEEPSEEK_API_KEY,
    call: async (system, prompt) => {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          temperature: 0.85,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(25000),
      })
      if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
      const data = await res.json()
      return data.choices[0].message.content
    },
  },
  {
    name: 'claude',
    available: () => !!process.env.CLAUDE_API_KEY,
    call: async (system, prompt) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(25000),
      })
      if (!res.ok) throw new Error(`Claude ${res.status}`)
      const data = await res.json()
      return data.content[0].text
    },
  },
  {
    name: 'openai',
    available: () => !!process.env.OPENAI_API_KEY,
    call: async (system, prompt) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          temperature: 0.85,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(25000),
      })
      if (!res.ok) throw new Error(`OpenAI ${res.status}`)
      const data = await res.json()
      return data.choices[0].message.content
    },
  },
]

/**
 * 调用 AI，自动 fallback。全部失败时返回 null
 */
export async function callAI(
  system: string,
  prompt: string
): Promise<string | null> {
  for (const provider of providers) {
    if (!provider.available()) continue
    try {
      return await provider.call(system, prompt)
    } catch (err) {
      console.error(`[AI] ${provider.name} failed:`, err)
    }
  }
  return null
}

// ============================================
// 无 AI 时的本地模板回复
// ============================================

export function fallbackChat(userMessage: string): ChatResponse {
  const rules: {
    pattern: RegExp
    reply: string
    mood: string
    keywords: string[]
    explore: boolean
  }[] = [
    {
      pattern: /累|疲|困|辛苦|加班/,
      reply: '呀...辛苦了。要不我出去找点能让你放松的东西？',
      mood: 'calm',
      keywords: ['休息', '放松'],
      explore: true,
    },
    {
      pattern: /开心|高兴|快乐|太好了|哈哈/,
      reply: '嘿嘿，你开心我也开心~ 今天真是好日子！',
      mood: 'happy',
      keywords: ['快乐', '阳光'],
      explore: false,
    },
    {
      pattern: /难过|伤心|不好|烦|郁闷/,
      reply: '别难过...我陪着你呢。要不我出去找点好玩的给你看？',
      mood: 'calm',
      keywords: ['安慰', '温暖'],
      explore: true,
    },
    {
      pattern: /探索|出去|走走|冒险|外面/,
      reply: '好呀好呀！我也正想出去看看呢！外面一定有好多有趣的东西！',
      mood: 'excited',
      keywords: ['冒险', '探索'],
      explore: true,
    },
    {
      pattern: /吃|饿|美食|好吃|零食/,
      reply: '说到吃的我就精神了！听说远处有片果园呢，嘿嘿~',
      mood: 'excited',
      keywords: ['美食', '果园'],
      explore: false,
    },
    {
      pattern: /花|草|植物|自然|树/,
      reply: '你也喜欢植物呀！我上次看到一朵好漂亮的花~',
      mood: 'happy',
      keywords: ['自然', '植物'],
      explore: false,
    },
    {
      pattern: /星|月|夜|晚上|天空/,
      reply: '夜空好美呀...我有时候会望着星星想事情呢，嘿嘿',
      mood: 'calm',
      keywords: ['星空', '夜晚'],
      explore: false,
    },
    {
      pattern: /你好|嗨|早|晚安|hello/i,
      reply: '嘿嘿~你好呀！',
      mood: 'happy',
      keywords: ['问候'],
      explore: false,
    },
    {
      pattern: /名字|叫什么|你是谁/,
      reply: '我是你的卡皮巴拉呀！最喜欢泡在河里和你聊天了，嘿嘿~',
      mood: 'happy',
      keywords: ['介绍'],
      explore: false,
    },
  ]

  for (const rule of rules) {
    if (rule.pattern.test(userMessage)) {
      return {
        reply: rule.reply,
        mood: rule.mood,
        keywords: rule.keywords,
        want_to_explore: rule.explore,
      }
    }
  }

  // 默认回复池
  const defaults = [
    { reply: '嘿嘿~我在认真听呢！', mood: 'happy' },
    { reply: '呀，真的吗？好有意思~', mood: 'curious' },
    { reply: '嗯嗯，然后呢然后呢？', mood: 'curious' },
    { reply: '嗯...让我想想...', mood: 'calm' },
    { reply: '哦哦！我懂了！嘿嘿~', mood: 'happy' },
  ]
  const d = defaults[Math.floor(Math.random() * defaults.length)]
  return {
    reply: d.reply,
    mood: d.mood,
    keywords: ['散步', '好奇'],
    want_to_explore: Math.random() > 0.75,
  }
}

export function fallbackExploration(keywords: string[]) {
  const locations = [
    {
      name: '静谧小溪',
      description: '一条清澈见底的小溪，阳光穿过树叶洒在水面上',
      theme: '自然',
      items: [
        { name: '彩色鹅卵石', description: '圆润光滑，带着温暖的色泽', category: 'collectible' as const, rarity: 'common' as const },
      ],
    },
    {
      name: '雾中竹林',
      description: '薄雾笼罩的竹林，竹叶间传来清脆的风铃声',
      theme: '神秘',
      items: [
        { name: '翡翠竹叶', description: '通透如玉的竹叶，在光下闪闪发亮', category: 'plant' as const, rarity: 'uncommon' as const },
      ],
    },
    {
      name: '向日葵田',
      description: '一望无际的向日葵田，金色花海在微风中摇曳',
      theme: '自然',
      items: [
        { name: '金色花瓣', description: '闪着金光的向日葵花瓣', category: 'decoration' as const, rarity: 'common' as const },
      ],
    },
    {
      name: '月光湖畔',
      description: '银色月光倒映在平静的湖面上，偶有萤火虫飞过',
      theme: '梦幻',
      items: [
        { name: '萤火瓶', description: '装满了温柔光芒的小玻璃瓶', category: 'decoration' as const, rarity: 'rare' as const },
      ],
    },
    {
      name: '古老石桥',
      description: '长满青苔的石桥横跨小河，桥下鱼儿自在游弋',
      theme: '怀旧',
      items: [
        { name: '苔藓石', description: '布满柔软苔藓的小石头，生机盎然', category: 'collectible' as const, rarity: 'common' as const },
      ],
    },
  ]

  const loc = locations[Math.floor(Math.random() * locations.length)]
  const types: ('short' | 'medium' | 'long')[] = ['short', 'short', 'medium', 'medium', 'long']
  const type = types[Math.floor(Math.random() * types.length)]
  // 测试模式：short=3分钟, medium=6分钟, long=12分钟
  const durationHours = type === 'short' ? 0.05 : type === 'medium' ? 0.1 : 0.2

  return {
    location: loc,
    type,
    durationHours,
    story: `${loc.description}。卡皮巴拉在这里溜达了一圈，发现了${loc.items[0].name}，开心地带了回来~`,
    items: loc.items,
  }
}
