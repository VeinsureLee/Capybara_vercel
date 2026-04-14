import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/capybara - 获取当前用户的卡皮巴拉
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: capybara } = await supabase
    .from('capybaras')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  return NextResponse.json({ capybara })
}

/**
 * POST /api/capybara - 创建卡皮巴拉
 * body: { name?: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 检查是否已有卡皮巴拉
  const { data: existing } = await supabase
    .from('capybaras')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: '你已经有一只卡皮巴拉了' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || '卡皮'

  const { data: capybara, error } = await supabase
    .from('capybaras')
    .insert({
      owner_id: user.id,
      name,
      personality_type: 'default',
      traits: ['治愈', '淡定', '好奇', '友善'],
      mood: 'happy',
      status: 'home',
      memory: [],
    })
    .select()
    .single()

  if (error) {
    console.error('Create capybara error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ capybara })
}
