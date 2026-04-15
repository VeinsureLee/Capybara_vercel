import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/memory - 获取记忆库
 * ?filter=shareable | private | all (default: all)
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = req.nextUrl.searchParams.get('filter') ?? 'all'

  let query = supabase
    .from('memories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (filter === 'shareable') {
    query = query.eq('shareable', true)
  } else if (filter === 'private') {
    query = query.eq('shareable', false)
  }

  const { data: memories } = await query.limit(100)

  return NextResponse.json({ memories: memories ?? [] })
}

/**
 * PATCH /api/memory - 切换记忆的 shareable 状态
 * body: { id: string, shareable: boolean }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, shareable } = body as { id: string; shareable: boolean }

  if (!id || typeof shareable !== 'boolean') {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('memories')
    .update({ shareable, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ memory: data })
}

/**
 * DELETE /api/memory - 删除记忆
 * body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
