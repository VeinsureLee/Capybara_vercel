export interface Capybara {
  id: string
  owner_id: string
  name: string
  personality_type: string
  traits: string[]
  mood: string
  experience: number
  level: number
  status: 'home' | 'exploring' | 'visiting' | 'traveling' | 'resting'
  memory: string[]
  /** V2: 当前装扮 */
  equipped_costumes?: Record<CostumeSlotType, string | null>
  /** V2: 当前生活层动作（仅 resting 状态） */
  current_life_action?: LifeAction | null
  /** V2: 上次旅行完成时间 */
  last_travel_completed_at?: string | null
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

// ============================================
// V2：记忆驱动旅行 + 每日手记 + 装扮系统
// 对齐 docs/product/卡皮巴拉产品设计文档_v2.md
// ============================================

/** 卡皮巴拉 V2 状态机：home ↔ traveling ↔ resting */
export type CapybaraStatusV2 = 'home' | 'traveling' | 'resting'

/** 结构化记忆条目（对话中提取，带分档） */
export interface Memory {
  id: string
  user_id: string
  capybara_id: string
  /** AI 归纳的主题标签，如"失去宠物"、"童年怀旧" */
  topic: string
  /** 原始对话片段摘要 */
  summary: string
  /** 情感标签 */
  emotion?: string
  /** 是否可分享给匹配系统 */
  shareable: boolean
  /** AI 自动判定的敏感类别，null 表示不敏感 */
  sensitive_category?: string | null
  /** 来源对话 ID */
  source_conversation_id?: string
  created_at: string
  updated_at: string
}

/** AI 对记忆的分类输出 */
export interface MemoryClassification {
  topic: string
  summary: string
  emotion: string
  shareable: boolean
  sensitive_category: string | null
}

/** 真实世界旅行地点 */
export interface TravelLocation {
  id: string
  /** 地点名，如"京都·下鸭神社附近" */
  name: string
  /** 所属区域/国家 */
  region: string
  /** 关键词标签 */
  tags: string[]
  /** 地点描述 */
  description: string
  /** 视觉关键词 */
  visual_keywords: string[]
  created_at: string
}

/** 一次多日旅行记录（替代 V1 的 Exploration） */
export interface Travel {
  id: string
  capybara_id: string
  user_id: string
  /** 旅行状态 */
  status: 'traveling' | 'completed'
  /** 目的地点 ID */
  location_id: string
  /** 旅行天数（1-5） */
  duration_days: number
  /** 触发旅行的意向词 */
  intent_keywords: string[]
  /** 被匹配的对方用户（可为 null） */
  matched_user_id?: string | null
  /** 带回物品 */
  items_found?: ExplorationItem[]
  /** 旅行故事摘要 */
  story?: string
  started_at: string
  /** 预计返回时间 */
  estimated_return: string
  completed_at?: string
  /** 当前正在进行的分段序号 */
  current_segment_order?: number
}

/** 旅行分段 — 一次旅行中的单个地点停留 */
export interface TravelSegment {
  id: string
  travel_id: string
  location_id: string
  segment_order: number
  started_at: string
  ended_at?: string | null
  /** 在该地点停留的天数（0.5 / 1.0 / 1.5 / 2.0） */
  duration_days: number
  /** 这是第几次来这个地点 */
  visit_count: number
  /** 初始新鲜感值 */
  freshness_initial: number
  /** join 的地点信息 */
  travel_locations?: { name: string; region: string; description: string } | null
}

/** 用户对某地点的历史访问记录 */
export interface LocationVisitRecord {
  user_id: string
  location_id: string
  visit_count: number
  last_visited_at: string
}

/** 每日旅行手记 */
export interface Journal {
  id: string
  travel_id: string
  user_id: string
  /** 第几天 */
  day_number: number
  /** 当天所在地点名 */
  location_name: string
  /** 手记叙事文字（80-180字） */
  narrative: string
  /** 匹配相遇段落（如有） */
  encounter_narrative?: string | null
  /** 被匹配的对方用户 ID */
  encounter_user_id?: string | null
  /** 匹配相似度分数 */
  encounter_score?: number | null
  /** 今日发现的小物件 */
  daily_item?: ExplorationItem | null
  /** V2.1: 图片标注数据（AI 生成的关键词+位置） */
  visual_highlights?: VisualHighlight[] | null
  created_at: string
}

/** V2.1: 手记中的视觉标注项，用于在地点图片上展示 */
export interface VisualHighlight {
  /** 手记中的关键词 */
  keyword: string
  /** 简短描述（1行） */
  description: string
  /** AI 建议的大致位置区域 */
  suggested_position: 'top-left' | 'top-center' | 'top-right' | 'left-center' | 'center' | 'right-center' | 'bottom-left' | 'bottom-center' | 'bottom-right'
}

/** 卡皮装扮槽位 */
export type CostumeSlotType = 'head' | 'body' | 'tail' | 'accessory'

export interface CostumeItem {
  id: string
  name: string
  slot: CostumeSlotType
  description: string
  /** 来历说明（探索获得的才有） */
  origin_story?: string
  /** 来源 */
  source: 'exploration' | 'gift' | 'default'
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

/** 休息日生活层动作 */
export type LifeAction = 'sleep' | 'swim' | 'idle' | 'eat' | 'gaze'

/** 卡皮装扮情绪反馈 */
export type CostumeReaction = 'happy' | 'neutral' | 'uncomfortable'

/** V2 Chat Response（扩展记忆意愿） */
export interface ChatResponseV2 {
  reply: string
  mood: string
  keywords: string[]
  want_to_travel: boolean
  /** 卡皮对本次对话中记忆的态度表达 */
  memory_reaction?: string | null
  /** 提取到的记忆候选 */
  memory_extract?: MemoryClassification | null
}
