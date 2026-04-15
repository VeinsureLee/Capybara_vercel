/**
 * V2 记忆驱动匹配
 * 全局配对：每天对所有旅行中的用户按记忆相似度配对
 */
import { jaccard } from '@/lib/sim/jaccard'

export interface MatchableUser {
  user_id: string
  /** 可分享的记忆主题列表 */
  shareable_topics: string[]
  /** 可分享的记忆情感列表 */
  shareable_emotions: string[]
  /** 最近对话意向词 */
  intent_keywords: string[]
}

export interface MatchResult {
  user_a: string
  user_b: string
  /** 记忆相似度 0-1 */
  memory_score: number
  /** 共振主题 */
  shared_topics: string[]
}

/**
 * 计算两个用户的记忆相似度
 * V2 公式：0.6·topic_sim + 0.25·emotion_sim + 0.15·intent_sim
 */
export function memoryScore(a: MatchableUser, b: MatchableUser): number {
  const topicSim = jaccard(a.shareable_topics, b.shareable_topics)
  const emotionSim = jaccard(a.shareable_emotions, b.shareable_emotions)
  const intentSim = jaccard(a.intent_keywords, b.intent_keywords)

  return 0.6 * topicSim + 0.25 * emotionSim + 0.15 * intentSim
}

/**
 * 找出两个用户之间的共振主题
 */
export function findSharedTopics(a: MatchableUser, b: MatchableUser): string[] {
  const setA = new Set(a.shareable_topics)
  return b.shareable_topics.filter((t) => setA.has(t))
}

/**
 * 全局贪心配对
 * 输入：当日所有旅行中的用户
 * 输出：配对列表 + 未配对用户
 *
 * V2 设计：贪心按记忆相似度配对，奇数剩 1 人 → 无匹配
 */
export function globalMatch(users: MatchableUser[]): {
  matches: MatchResult[]
  unmatched: string[]
} {
  if (users.length < 2) {
    return { matches: [], unmatched: users.map((u) => u.user_id) }
  }

  // 计算所有两两配对的分数
  const pairs: { i: number; j: number; score: number; topics: string[] }[] = []
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const score = memoryScore(users[i], users[j])
      const topics = findSharedTopics(users[i], users[j])
      pairs.push({ i, j, score, topics })
    }
  }

  // 按分数降序排列
  pairs.sort((a, b) => b.score - a.score)

  // 贪心配对
  const matched = new Set<number>()
  const matches: MatchResult[] = []

  for (const pair of pairs) {
    if (matched.has(pair.i) || matched.has(pair.j)) continue
    matched.add(pair.i)
    matched.add(pair.j)
    matches.push({
      user_a: users[pair.i].user_id,
      user_b: users[pair.j].user_id,
      memory_score: pair.score,
      shared_topics: pair.topics,
    })
  }

  const unmatched = users
    .map((u, idx) => ({ id: u.user_id, idx }))
    .filter(({ idx }) => !matched.has(idx))
    .map(({ id }) => id)

  return { matches, unmatched }
}
