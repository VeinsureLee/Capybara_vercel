/**
 * 旅行时间配置
 *
 * 测试阶段：所有时间单位以分钟代替天
 * 上线时将 TESTING_MODE 改为 false 即可切换回正常时间
 */

const TESTING_MODE = true

/** 1 "天" 对应的毫秒数 */
export const MS_PER_DAY = TESTING_MODE
  ? 1 * 60 * 1000        // 测试：1 分钟 = 1 天
  : 24 * 60 * 60 * 1000  // 生产：24 小时 = 1 天

/** 地点冷却期（"天"数） */
export const LOCATION_COOLDOWN_DAYS = 30

/** 地点冷却期对应的毫秒数 */
export const LOCATION_COOLDOWN_MS = LOCATION_COOLDOWN_DAYS * MS_PER_DAY

/** 休息期时长范围（"天"数） */
export const REST_DAYS_MIN = 1
export const REST_DAYS_MAX = 2

/** 随机休息天数 */
export function randomRestDays(): number {
  return REST_DAYS_MIN + Math.floor(Math.random() * (REST_DAYS_MAX - REST_DAYS_MIN + 1))
}

/** 是否为测试模式 */
export const isTesting = TESTING_MODE
