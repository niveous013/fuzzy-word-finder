import { describe, expect, it } from 'vitest'
import { editDistance, findCandidates, soundKey } from './candidates'

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
})
