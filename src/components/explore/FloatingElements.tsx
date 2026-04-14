'use client'

/**
 * 通用飘浮元素组件 - 从右向左飘过的 emoji
 */
export function FloatingElements({
  items,
  speed = 'normal',
  layer = 'near',
}: {
  items: string[]
  speed?: 'slow' | 'normal' | 'fast'
  layer?: 'near' | 'far'
}) {
  const duration = {
    slow: layer === 'far' ? 25 : 15,
    normal: layer === 'far' ? 18 : 10,
    fast: layer === 'far' ? 12 : 7,
  }[speed]

  const size = layer === 'far' ? 'text-lg opacity-40' : 'text-2xl opacity-70'

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((item, i) => (
        <span
          key={i}
          className={`absolute ${size} animate-float-left`}
          style={{
            top: `${10 + ((i * 37) % 60)}%`,
            animationDuration: `${duration + i * 1.5}s`,
            animationDelay: `${i * (duration / items.length)}s`,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

/**
 * 地面滚动元素
 */
export function GroundElements({ items }: { items: string[] }) {
  return (
    <div className="absolute bottom-16 left-0 right-0 overflow-hidden pointer-events-none h-12">
      {items.map((item, i) => (
        <span
          key={i}
          className="absolute text-xl animate-ground-scroll"
          style={{
            bottom: `${(i * 13) % 20}px`,
            animationDuration: `${8 + i * 2}s`,
            animationDelay: `${i * 2}s`,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

/**
 * 庆祝撒花
 */
export function Confetti() {
  const particles = ['🎉', '✨', '🌸', '⭐', '🎊', '💫', '🌟', '🎀']
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute text-xl animate-confetti"
          style={{
            left: `${5 + i * 12}%`,
            animationDelay: `${i * 0.2}s`,
            animationDuration: `${2 + Math.random()}s`,
          }}
        >
          {p}
        </span>
      ))}
    </div>
  )
}
