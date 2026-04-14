'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname: nickname || '旅人' },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      // 邮箱免验证模式，直接跳转
      router.push('/chat')
      router.refresh()
    } else {
      // 需要邮箱验证
      setMessage('注册成功！请检查邮箱完成验证后登录。')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🦫</div>
          <h1 className="text-2xl font-bold text-capybara-700">加入 Capybara</h1>
          <p className="text-gray-400 text-sm mt-1">创建账号，开始养你的卡皮巴拉</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white
                         focus:outline-none focus:ring-2 focus:ring-capybara-300 text-sm"
              placeholder="给自己起个名字（选填）"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white
                         focus:outline-none focus:ring-2 focus:ring-capybara-300 text-sm"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white
                         focus:outline-none focus:ring-2 focus:ring-capybara-300 text-sm"
              placeholder="至少 6 位"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
          {message && (
            <p className="text-green-600 text-sm text-center">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-capybara-500 text-white rounded-xl font-medium
                       hover:bg-capybara-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          已有账号？{' '}
          <a href="/login" className="text-capybara-500 hover:underline">
            登录
          </a>
        </p>
      </div>
    </div>
  )
}
