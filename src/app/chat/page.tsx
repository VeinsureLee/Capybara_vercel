'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import type { Capybara, Conversation } from '@/types'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ============================================
// 状态管理: 三种视图
// 1. loading   - 加载中
// 2. setup     - 创建卡皮巴拉
// 3. chat      - 正常聊天
// ============================================

export default function ChatPage() {
  const [view, setView] = useState<'loading' | 'setup' | 'chat'>('loading')
  const [capybara, setCapybara] = useState<Capybara | null>(null)
  const [messages, setMessages] = useState<Conversation[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [setupName, setSetupName] = useState('')
  const [showExplorePrompt, setShowExplorePrompt] = useState(false)
  const [explorationInfo, setExplorationInfo] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 初始化：获取卡皮巴拉
  useEffect(() => {
    loadCapybara()
  }, [])

  async function loadCapybara() {
    const res = await fetch('/api/capybara')
    const data = await res.json()
    if (data.capybara) {
      setCapybara(data.capybara)
      await loadMessages()
      await checkExploration()
      setView('chat')
    } else {
      setView('setup')
    }
  }

  async function loadMessages() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)

    setMessages(data || [])
  }

  async function checkExploration() {
    const res = await fetch('/api/explore')
    const data = await res.json()
    if (data.exploration) {
      if (data.just_completed) {
        setExplorationInfo(
          `🎉 ${capybara?.name || '卡皮'}回来了！带回了：${(data.exploration.items_found || []).map((i: { name: string }) => i.name).join('、') || '一些回忆'}`
        )
        // 刷新卡皮巴拉状态
        const capRes = await fetch('/api/capybara')
        const capData = await capRes.json()
        if (capData.capybara) setCapybara(capData.capybara)
      } else if (data.exploration.status === 'ongoing') {
        const returnTime = new Date(data.exploration.estimated_return)
        const remaining = Math.max(
          0,
          Math.ceil((returnTime.getTime() - Date.now()) / 60000)
        )
        setExplorationInfo(
          `🗺️ ${capybara?.name || '卡皮'}正在探索中... 预计 ${remaining} 分钟后回来`
        )
      }
    }
  }

  // 滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 定期检查探索状态
  useEffect(() => {
    if (capybara?.status !== 'exploring') return
    const interval = setInterval(checkExploration, 15000) // 15秒检查一次
    return () => clearInterval(interval)
  }, [capybara?.status])

  // 创建卡皮巴拉
  async function createCapybara() {
    const res = await fetch('/api/capybara', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: setupName.trim() || '卡皮' }),
    })
    const data = await res.json()
    if (data.capybara) {
      setCapybara(data.capybara)
      setView('chat')
    }
  }

  // 发送消息
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return

    const text = input.trim()
    setInput('')
    setSending(true)

    // 乐观更新
    const optimisticMsg: Conversation = {
      id: uid(),
      user_id: '',
      capybara_id: '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()

      const replyMsg: Conversation = {
        id: uid(),
        user_id: '',
        capybara_id: '',
        role: 'capybara',
        content: data.reply,
        mood: data.mood,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, replyMsg])

      // 更新心情
      if (capybara) {
        setCapybara({ ...capybara, mood: data.mood })
      }

      // 探索提示
      if (data.want_to_explore) {
        setShowExplorePrompt(true)
      }
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }

  // 发起探索
  async function startExploration() {
    setShowExplorePrompt(false)
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      if (data.departure_message) {
        const sysMsg: Conversation = {
          id: uid(),
          user_id: '',
          capybara_id: '',
          role: 'capybara',
          content: `🎒 ${data.departure_message}`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, sysMsg])

        if (capybara) {
          setCapybara({ ...capybara, status: 'exploring' })
        }

        const returnTime = new Date(data.estimated_return)
        const remaining = Math.ceil(
          (returnTime.getTime() - Date.now()) / 60000
        )
        setExplorationInfo(
          `🗺️ ${capybara?.name || '卡皮'}出发了！预计 ${remaining} 分钟后回来`
        )
      }
    } catch (err) {
      console.error('Explore error:', err)
    }
  }

  const moodLabel: Record<string, string> = {
    happy: '开心 ☀️',
    calm: '平静 🌿',
    excited: '兴奋 ✨',
    sleepy: '困困 💤',
    curious: '好奇 🔍',
  }

  // ============================================
  // 渲染
  // ============================================

  // Loading
  if (view === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-5xl animate-bounce-slow">🦫</div>
        <p className="text-gray-400 mt-4 text-sm">加载中...</p>
      </div>
    )
  }

  // Setup: 创建卡皮巴拉
  if (view === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-7xl mb-6 animate-bounce-slow">🦫</div>
        <h2 className="text-xl font-bold text-capybara-700 mb-2">
          给你的卡皮巴拉起个名字吧
        </h2>
        <p className="text-gray-400 text-sm mb-6">它会成为你最好的伙伴~</p>
        <input
          type="text"
          value={setupName}
          onChange={(e) => setSetupName(e.target.value)}
          placeholder="卡皮"
          maxLength={10}
          className="w-64 px-4 py-3 rounded-xl border border-gray-200 bg-white
                     text-center text-lg focus:outline-none focus:ring-2 focus:ring-capybara-300"
        />
        <button
          onClick={createCapybara}
          className="mt-4 px-8 py-3 bg-capybara-500 text-white rounded-xl font-medium
                     hover:bg-capybara-600 transition"
        >
          就叫这个名字！
        </button>
      </div>
    )
  }

  // Chat 主界面
  return (
    <div className="flex flex-col h-screen">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100">
        <span className="text-2xl">🦫</span>
        <div className="flex-1">
          <div className="font-semibold text-gray-800 text-sm">
            {capybara?.name || '卡皮'}
          </div>
          <div className="text-[11px] text-gray-400">
            {capybara?.status === 'exploring'
              ? '探索中...'
              : moodLabel[capybara?.mood || 'calm'] || '平静'}
          </div>
        </div>
        <div className="text-xs text-gray-300">
          Lv.{capybara?.level || 1}
        </div>
      </div>

      {/* 探索状态横幅 */}
      {explorationInfo && (
        <div
          className="mx-3 mt-2 px-3 py-2 bg-river-50 border border-river-200 rounded-lg text-xs text-river-700 cursor-pointer"
          onClick={checkExploration}
        >
          {explorationInfo}
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-300 text-sm mt-20">
            跟 {capybara?.name || '卡皮'} 说点什么吧~
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user'
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && <span className="text-lg mr-1.5 mt-1">🦫</span>}
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                  isUser
                    ? 'bg-capybara-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
                <p
                  className={`text-[10px] mt-1 ${
                    isUser ? 'text-capybara-200' : 'text-gray-300'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}

        {sending && (
          <div className="flex gap-1 ml-8">
            <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
            <span
              className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 探索提示卡片 */}
      {showExplorePrompt && capybara?.status === 'home' && (
        <div className="mx-3 mb-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <p className="text-sm text-amber-800 mb-2">
            🎒 {capybara.name}想出门探索，看看能发现什么好东西~
          </p>
          <div className="flex gap-2">
            <button
              onClick={startExploration}
              className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm
                         hover:bg-amber-600 transition font-medium"
            >
              让它去吧
            </button>
            <button
              onClick={() => setShowExplorePrompt(false)}
              className="flex-1 py-2 bg-white text-amber-600 rounded-lg text-sm
                         border border-amber-300 hover:bg-amber-50 transition"
            >
              再聊聊
            </button>
          </div>
        </div>
      )}

      {/* 输入框 */}
      <form onSubmit={sendMessage} className="px-3 py-2 bg-white/90 backdrop-blur border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              capybara?.status === 'exploring'
                ? `给探索中的${capybara.name}发消息...`
                : `跟${capybara?.name || '卡皮'}说点什么...`
            }
            disabled={sending}
            className="flex-1 px-4 py-2.5 rounded-full bg-gray-50 text-sm
                       focus:outline-none focus:ring-2 focus:ring-capybara-200
                       disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-5 py-2.5 rounded-full bg-capybara-500 text-white text-sm font-medium
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-capybara-600 transition"
          >
            发送
          </button>
        </div>
      </form>

      <BottomNav />
    </div>
  )
}
