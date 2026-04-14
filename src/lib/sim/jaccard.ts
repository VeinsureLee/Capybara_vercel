/**
 * 基于集合的相似度工具
 * 对齐 docs/architecture/卡皮巴拉串门与用户相似度匹配算法提案.md §4
 */

/** 经典 Jaccard：|A ∩ B| / |A ∪ B| */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (!a.length && !b.length) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let inter = 0
  for (const x of setA) if (setB.has(x)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * 带 recency 衰减的加权 Jaccard
 * tags 数组索引越小视为越近期，权重越大（默认 1 / (1 + i * 0.2)）
 */
export function weightedJaccard(
  a: readonly string[],
  b: readonly string[],
  decay = 0.2
): number {
  const weight = (i: number) => 1 / (1 + i * decay)
  const weightMap = (arr: readonly string[]) => {
    const m = new Map<string, number>()
    arr.forEach((tag, i) => {
      m.set(tag, Math.max(m.get(tag) ?? 0, weight(i)))
    })
    return m
  }
  const wa = weightMap(a)
  const wb = weightMap(b)

  let interW = 0
  let unionW = 0
  const keys = new Set([...wa.keys(), ...wb.keys()])
  for (const k of keys) {
    const xa = wa.get(k) ?? 0
    const xb = wb.get(k) ?? 0
    interW += Math.min(xa, xb)
    unionW += Math.max(xa, xb)
  }
  return unionW === 0 ? 0 : interW / unionW
}

/** 两个等长向量的余弦相似度（P1 启用 pgvector 后替换为 DB 侧计算） */
export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
