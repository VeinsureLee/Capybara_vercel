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
