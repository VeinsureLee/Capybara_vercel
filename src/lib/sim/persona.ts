import type { PersonaCard } from '@/types'
import { jaccard, weightedJaccard } from './jaccard'

/**
 * 敏感词 / 具体事件 → 主题级上位词
 * 提案 §3.1 的黑名单过滤（极简版，可按需扩充）
 */
const SENSITIVE_MAP: Array<[RegExp, string]> = [
  [/(父母|爸妈|妈妈|爸爸).*(吵架|矛盾|闹)/, '家庭关系'],
  [/(失眠|睡不着|熬夜)/, '睡眠'],
  [/(离职|辞职|裁员|老板)/, '工作压力'],
  [/(分手|前任|暗恋|相亲)/, '感情'],
  [/(焦虑|抑郁|崩溃|自我怀疑)/, '情绪'],
  [/(考研|考试|论文|deadline)/, '学业'],
  [/(搬家|租房|房东)/, '居住'],
  [/(身体|生病|医院|感冒)/, '健康'],
]

const BROAD_TOPICS = [
  '自然', '夜晚', '星空', '水', '食物', '远行', '动物',
  '休息', '阅读', '音乐', '回忆', '孤独', '陪伴',
]

/**
 * 从 memory 关键词脱敏到主题词。
 * P0 只做黑名单替换 + 白名单过滤；K-means 聚类留到 P1 引入 embedding 时再做。
 */
export function sanitizeMemoryTopics(memory: readonly string[]): string[] {
  const out = new Set<string>()
  for (const raw of memory) {
    if (!raw) continue
    let topic: string | null = null
    for (const [pat, mapped] of SENSITIVE_MAP) {
      if (pat.test(raw)) {
        topic = mapped
        break
      }
    }
    if (!topic) {
      // 白名单：命中常见"安全主题"才保留
      const hit = BROAD_TOPICS.find((t) => raw.includes(t))
      if (hit) topic = hit
    }
    if (topic) out.add(topic)
  }
  return Array.from(out).slice(0, 8)
}

/**
 * 精排打分：score(A, Bi) = w1·sim_vec + w2·sim_trait + w3·sim_tag - w4·penalty
 * P0 暂无向量，sim_vec 退化为 traits 与 memory_topics 的 Jaccard。
 */
export interface ScoreBreakdown {
  sim_vec: number
  sim_trait: number
  sim_tag: number
  diversity_penalty: number
  score: number
}

export function scorePair(
  a: PersonaCard,
  b: PersonaCard,
  weights: [number, number, number, number] = [0.5, 0.2, 0.2, 0.1]
): ScoreBreakdown {
  const [w1, w2, w3, w4] = weights

  const sim_vec = jaccard(a.memory_topics, b.memory_topics)
  const sim_trait = jaccard(a.traits, b.traits)
  const sim_tag = weightedJaccard(a.recent_tags, b.recent_tags)

  // diversity_penalty：过度同质化惩罚（避免只匹配"最像自己"）
  // 简单定义：三路都 > 0.85 时才开始惩罚
  const maxSim = Math.max(sim_vec, sim_trait, sim_tag)
  const diversity_penalty = maxSim > 0.85 ? maxSim - 0.85 : 0

  const score =
    w1 * sim_vec + w2 * sim_trait + w3 * sim_tag - w4 * diversity_penalty

  return { sim_vec, sim_trait, sim_tag, diversity_penalty, score }
}

/**
 * user_sim = α · score + β · affinity + γ · tone_match
 * 默认 α=0.3, β=0.5, γ=0.2（提案 §4.3）
 */
export function userSim(
  score: number,
  affinity: number,
  tone_match: number,
  weights: [number, number, number] = [0.3, 0.5, 0.2]
): number {
  const [a, b, g] = weights
  const v = a * score + b * affinity + g * tone_match
  return Math.max(0, Math.min(1, v))
}

/** (user_low, user_high) 归一化，符合 user_affinity 的 CHECK 约束 */
export function orderUsers(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x]
}
