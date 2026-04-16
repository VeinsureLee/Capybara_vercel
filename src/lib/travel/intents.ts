import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 聚合用户的短期+长期意向词
 * 短期（最近10条对话）权重高，长期（最近50条）权重低
 * 返回 top 8 意向词
 */
export async function aggregateIntents(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: recentConvos } = await supabase
    .from('conversations')
    .select('keywords')
    .eq('user_id', userId)
    .not('keywords', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const keywordWeights: Record<string, number> = {}

  ;(recentConvos || []).forEach((conv, i) => {
    const kws = conv.keywords as string[]
    if (!kws) return

    // 短期（前10条）权重高，长期（10-50条）权重低
    let weight: number
    if (i < 10) {
      weight = 1.0 - i * 0.05  // 1.0 → 0.55
    } else {
      weight = Math.max(0.05, 0.3 - (i - 10) * 0.005)  // 0.3 → 0.1
    }

    kws.forEach((kw) => {
      keywordWeights[kw] = (keywordWeights[kw] || 0) + weight
    })
  })

  return Object.entries(keywordWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([kw]) => kw)
}
