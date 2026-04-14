export interface Capybara {
  id: string
  owner_id: string
  name: string
  personality_type: string
  traits: string[]
  mood: string
  experience: number
  level: number
  status: 'home' | 'exploring' | 'visiting'
  memory: string[]
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  capybara_id: string
  role: 'user' | 'capybara'
  content: string
  mood?: string
  keywords?: string[]
  created_at: string
}

export interface Exploration {
  id: string
  capybara_id: string
  user_id: string
  status: 'ongoing' | 'completed'
  exploration_type: 'short' | 'medium' | 'long'
  trigger_keywords?: string[]
  story?: string
  items_found?: ExplorationItem[]
  started_at: string
  estimated_return: string
  completed_at?: string
}

export interface ExplorationItem {
  name: string
  description: string
  category: 'decoration' | 'plant' | 'collectible' | 'interactive'
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

export interface ChatResponse {
  reply: string
  mood: string
  keywords: string[]
  want_to_explore: boolean
}

// ============================================
// 串门 & 用户相似度匹配
// 对齐 docs/architecture/卡皮巴拉串门与用户相似度匹配算法提案.md
// ============================================

/**
 * 参与匹配的唯一实体。只暴露"可对外交流的抽象特征"，
 * 用户隐私原文不会进入 PersonaCard。
 */
export interface PersonaCard {
  capybara_id: string
  owner_id: string
  name: string
  traits: string[]
  mood: string | null
  level: number
  memory_topics: string[]
  recent_tags: string[]
  /** P1 启用 pgvector 后填充 */
  topic_vector?: number[]
  updated_at: string
}

/** 两只卡皮巴拉一次串门的完整记录 */
export interface Visit {
  id: string
  a_capybara: string
  b_capybara: string
  a_owner: string
  b_owner: string
  score: number | null
  transcript: VisitTurn[]
  eval: VisitEval | null
  status: 'pending' | 'completed' | 'discarded'
  created_at: string
}

export interface VisitTurn {
  speaker: 'A' | 'B'
  text: string
}

/** §4.3 裁判 prompt 的输出 */
export interface VisitEval {
  affinity: number
  shared_topics: string[]
  tone_match: number
  novelty: number
  summary_for_A: string
  summary_for_B: string
  /** 是否命中隐私检测分支 */
  contains_private?: boolean
}

/** (user_low, user_high) 去重后的用户亲和度 */
export interface UserAffinity {
  user_low: string
  user_high: string
  user_sim: number
  affinity: number | null
  shared_topics: string[]
  last_visit_at: string
}
