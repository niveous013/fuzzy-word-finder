import { findCandidates } from '../src/lib/candidates'
import type { SearchInput } from '../src/types'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const input = await request.json() as SearchInput
  if (!input.query?.trim()) return Response.json({ error: '请输入猜测拼写。' }, { status: 400 })
  return Response.json({ candidates: findCandidates(input) })
}
