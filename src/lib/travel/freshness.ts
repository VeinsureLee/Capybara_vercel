/**
 * 新鲜感算法：根据历史访问次数计算在某地点的停留天数
 *
 * base_stay = 2.0 天
 * visit_penalty = visit_count × 0.5 天
 * stay = max(0.5, base_stay - visit_penalty)
 *
 * 第1次: 1.5天, 第2次: 1.0天, 第3次: 0.5天, 第4次+: 0.5天
 */

const BASE_STAY = 2.0
const VISIT_PENALTY = 0.5
const MIN_STAY = 0.5

/**
 * 计算在某地点的停留天数
 * @param visitCount 历史访问次数（本次算第 visitCount 次）
 * @returns 停留天数（0.5 的倍数）
 */
export function calculateStayDuration(visitCount: number): number {
  const raw = BASE_STAY - visitCount * VISIT_PENALTY
  const rounded = Math.round(Math.max(MIN_STAY, raw) * 2) / 2
  return rounded
}

/**
 * 计算初始新鲜感值（与 visitCount 反相关）
 */
export function calculateFreshness(visitCount: number): number {
  return Math.max(MIN_STAY, BASE_STAY - visitCount * VISIT_PENALTY)
}
