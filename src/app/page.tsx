import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/chat')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="text-8xl mb-6 animate-bounce-slow">🦫</div>
      <h1 className="text-3xl font-bold text-capybara-700 mb-3">
        Capybara
      </h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        养一只卡皮巴拉，跟它聊天决定它去哪探索，
        <br />
        它带回的东西构成你独一无二的空间
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a
          href="/register"
          className="block w-full py-3 px-6 bg-capybara-500 text-white rounded-xl
                     text-center font-medium hover:bg-capybara-600 transition"
        >
          开始养卡皮巴拉
        </a>
        <a
          href="/login"
          className="block w-full py-3 px-6 bg-white text-capybara-600 rounded-xl
                     text-center font-medium border border-capybara-200 hover:bg-capybara-50 transition"
        >
          已有账号，登录
        </a>
      </div>
    </div>
  )
}
