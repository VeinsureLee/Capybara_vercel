'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/home', icon: '🏠', label: '河岸' },
  { href: '/chat', icon: '💬', label: '聊天' },
  { href: '/explore', icon: '🗺️', label: '探索' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center justify-around py-2 bg-white/90 backdrop-blur border-t border-gray-100 safe-area-pb">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-lg transition
              ${active ? 'text-capybara-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
