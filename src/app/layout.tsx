import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Capybara - 卡皮巴拉养成',
  description: '养一只卡皮巴拉，跟它聊天，让它去探索世界',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gradient-to-b from-meadow-50 to-river-50 min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
