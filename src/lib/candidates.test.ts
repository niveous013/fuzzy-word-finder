import { describe, expect, it } from 'vitest'
import { editDistance, findCandidates, searchCandidates, soundKey } from './candidates'
import { guessPronunciation } from './phonetics'
import { preferencesFromHistory, spellingChanges } from './history'

describe('候选排序', () => {
  it('把 because 排在 becos 的候选前列', () => {
    const candidates = findCandidates({ query: 'becos', clues: ['vowel'], domain: 'general' })
    expect(candidates[0]?.term).toBe('because')
    expect(candidates[0]?.reasons).toContain('元音组合可能没有听清')
  })

  it('支持常见短语候选', () => {
    const candidates = findCandidates({ query: 'look foward to', clues: [], domain: 'general' })
    expect(candidates.some((candidate) => candidate.term === 'look forward to')).toBe(true)
  })

  it('规范化近音键并正确计算编辑距离', () => {
    expect(soundKey('phone')).toBe(soundKey('fone'))
    expect(editDistance('word', 'work')).toBe(1)
  })

  it('拒绝过短输入', () => {
    expect(findCandidates({ query: 'a', clues: [] })).toEqual([])
  })

  it('按听音拼写找到 breathe，并过滤 together', () => {
    const candidates = findCandidates({ query: 'breeth', clues: [] })
    expect(candidates[0]?.term).toBe('breathe')
    expect(candidates.some(item => item.term === 'together')).toBe(false)
    expect(candidates.some(item => item.term === 'create')).toBe(false)
  })
  it('精确拼写优先且无关输入不凑八个', () => {
    expect(findCandidates({ query: 'breathe', clues: [] })[0]?.term).toBe('breathe')
    expect(findCandidates({ query: 'zzzzzzzzzzzzzzzzzz', clues: [] })).toHaveLength(0)
  })
  it('下一批没有重复，且能够加载八个之后的候选', () => {
    const input = { query: 'breeth', clues: [] }
    const first = searchCandidates(input)
    const next = searchCandidates({ ...input, exclude: first.candidates.map(item => item.term) })
    expect(first.hasMore).toBe(true)
    expect(next.candidates.length).toBeGreaterThan(0)
    expect(next.candidates.every(item => !first.candidates.some(old => old.term === item.term))).toBe(true)
  })
  it('修正音标和反馈会重新推测读音并改变排序', () => {
    const first = searchCandidates({ query: 'breeth', clues: [] })
    const corrected = searchCandidates({ query: 'breeth', clues: [], pronunciation: 'brɛd' })
    expect(corrected.candidates[0]?.term).toBe('bread')
    const retry = searchCandidates({ query: 'breeth', clues: [], feedback: ['vowel'] })
    expect(retry.pronunciation.ipa).not.toBe(first.pronunciation.ipa)
  })
  it('语境与学习领域只提供有限加权', () => {
    const plain = searchCandidates({ query: 'breeth', clues: [] })
    const context = searchCandidates({ query: 'breeth', clues: [], context: '医生让他深呼吸' })
    expect(context.candidates.find(item => item.term === 'breathe')!.score).toBeGreaterThan(plain.candidates.find(item => item.term === 'breathe')!.score)
    const learned = searchCandidates({ query: 'breeth', clues: [], preferences: { selectedTerms: [], domains: ['health'], domainCounts: { health: 1000000 } } })
    expect(learned.candidates.find(item => item.term === 'breathe')!.score - plain.candidates.find(item => item.term === 'breathe')!.score).toBeLessThanOrEqual(2.1)
  })
  it('区分字母差异并在未选领域时归纳最终词的领域', () => {
    expect(spellingChanges('breeth', 'breathe')).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'vowel' }), expect.objectContaining({ kind: 'missing' })]))
    expect(spellingChanges('breathee', 'breathe')).toEqual([{ kind: 'extra', from: 'e', to: '' }])
    const preferences = preferencesFromHistory([{ id: '1', query: 'breeth', selectedTerm: 'breathe', createdAt: '2026-01-01', confirmed: true }])
    expect(preferences.domainCounts?.health).toBe(1)
    expect(preferencesFromHistory([]).patterns).toEqual([])
    expect(guessPronunciation('breeth').source).toBe('rules')
    expect(preferencesFromHistory([{ id: 'legacy', query: 'breeth', selectedTerm: 'together', createdAt: '2026-01-01' }]).selectedTerms).toEqual([])
  })
})
