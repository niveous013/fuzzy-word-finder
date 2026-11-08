import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './refine'
const request = (body: unknown) => new Request('http://localhost/api/refine', { method: 'POST', body: JSON.stringify(body) })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('模型辅助接口', () => {
  it('未配置模型时清楚降级', async () => {
    vi.stubEnv('LLM_API_KEY', '')
    const response = await handler(request({ query: 'breeth', clues: [] }))
    const data = await response.json()
    expect(data.llm).toBe('unconfigured')
    expect(data.candidates[0].term).toBe('breathe')
  })
  it('拒绝格式错误或过大的请求', async () => {
    expect((await handler(request({ query: 12 }))).status).toBe(400)
    expect((await handler(request({ query: 'breeth', context: 'a'.repeat(25000) }))).status).toBe(413)
  })
  it('免费限流时保留本机结果', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-only')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    const data = await (await handler(request({ query: 'breeth', clues: [] }))).json()
    expect(data.llm).toBe('failed')
    expect(data.message).toContain('额度')
    expect(data.candidates[0].term).toBe('breathe')
  })
  it('传递学习摘要、移除重复与无效模型建议，不返回密钥', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-secret')
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ pronunciation: 'briːð', candidates: [{ term: 'breathe', domains: ['health'] }, { term: '<script>' }, { term: 'breath', ipa: 'brɛθ', domains: ['health'], reason: '元音长短可能混淆' }] }) } }] }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await handler(request({ query: 'breeth', clues: [], exclude: ['breathe'], preferences: { selectedTerms: ['private-history'], domains: ['health'], domainCounts: { health: 3 }, patterns: [{ kind: 'vowel', from: 'e', to: 'a', count: 2 }] } }))
    const data = await response.json()
    expect(data.llm).toBe('ok')
    expect(data.candidates[0].term).toBe('breath')
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.messages[1].content).toContain('learningSummary')
    expect(payload.messages[1].content).not.toContain('private-history')
    expect(JSON.stringify(data)).not.toContain('test-secret')
  })
})
