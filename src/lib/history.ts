import { inferDomains } from '../data/lexicon'
import type { HistoryItem, SpellingPattern, PatternKind, UserPreference } from '../types'
const HISTORY_KEY = 'fuzzy-word-finder-history'
export function readLocalHistory(): HistoryItem[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(data) ? data.filter((item): item is HistoryItem => item && typeof item.query === 'string' && typeof item.selectedTerm === 'string' && typeof item.id === 'string' && typeof item.createdAt === 'string').slice(0, 200) : []
  } catch { return [] }
}
export function addLocalHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): HistoryItem {
  const next = { ...item, confirmed: true, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  localStorage.setItem(HISTORY_KEY, JSON.stringify([next, ...readLocalHistory()].slice(0, 200)))
  return next
}
export function clearLocalHistory(): void { localStorage.removeItem(HISTORY_KEY) }
export function removeLocalHistory(id: string): HistoryItem[] {
  const next = readLocalHistory().filter(item => item.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); return next
}
const silentFinalE = new Set(['breathe', 'make', 'take', 'like', 'time', 'name', 'write', 'have', 'give', 'love', 'live', 'move', 'phone', 'drive', 'close', 'house', 'use', 'because', 'please'])
function describeEdit(word: string, index: number, missing: boolean): string[] {
  const letter = word[index]
  let start = index, end = index
  while (start > 0 && word[start - 1] === letter) start--
  while (end < word.length - 1 && word[end + 1] === letter) end++
  const details = [start === 0 ? '词首' : end === word.length - 1 ? '词尾' : '词中', /[aeiou]/.test(letter) ? '元音字母' : '辅音字母']
  if (word[index - 1] === letter || word[index + 1] === letter) details.push('相邻重复字母')
  if (missing && letter === 'e' && index === word.length - 1 && silentFinalE.has(word)) details.push('词尾 e 可能不发音')
  return details
}
export function spellingChanges(query: string, target: string): Omit<SpellingPattern, 'count'>[] {
  const a = query.toLowerCase().replace(/[^a-z]/g, ''), b = target.toLowerCase().replace(/[^a-z]/g, '')
  if (a.length > 80 || b.length > 80) return []
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i ? j ? 0 : i : j))
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]))
  const result: Omit<SpellingPattern, 'count'>[] = []
  let i = a.length, j = b.length
  while (i || j) {
    if (i && j && a[i - 1] === b[j - 1]) { i--; j-- }
    else if (i && j && matrix[i][j] === matrix[i - 1][j - 1] + 1) result.push({ kind: /[aeiouy]/.test(a[i - 1]) && /[aeiouy]/.test(b[j - 1]) ? 'vowel' : 'consonant', from: a[--i], to: b[--j] })
    else if (i && matrix[i][j] === matrix[i - 1][j] + 1) { i--; result.push({ kind: 'extra', from: a[i], to: '', details: describeEdit(a, i, false) }) }
    else { j--; result.push({ kind: 'missing', from: '', to: b[j], details: describeEdit(b, j, true) }) }
  }
  return result.reverse()
}
export const PATTERN_LABEL: Record<PatternKind, string> = { vowel: '元音字母混淆', consonant: '辅音／其他字母混淆', extra: '多写字母', missing: '漏写字母' }
export function preferencesFromHistory(items: HistoryItem[]): UserPreference {
  const patterns = new Map<string, SpellingPattern>(), domainCounts: Record<string, number> = {}
  const confirmed = items.filter(item => item.confirmed === true)
  for (const item of confirmed) {
    for (const change of spellingChanges(item.query, item.selectedTerm)) {
      const key = `${change.kind}:${change.from}:${change.to}:${(change.details ?? []).join(',')}`
      patterns.set(key, { ...change, count: (patterns.get(key)?.count ?? 0) + 1 })
    }
    const domains = new Set([...(item.domains ?? inferDomains(item.selectedTerm)), ...(item.domain && item.domain !== 'general' ? [item.domain] : [])])
    for (const domain of domains) domainCounts[domain] = (domainCounts[domain] ?? 0) + 1
  }
  return { selectedTerms: [...new Set(confirmed.map(item => item.selectedTerm))].slice(0, 30), domains: Object.keys(domainCounts), domainCounts, patterns: [...patterns.values()].sort((a, b) => b.count - a.count).slice(0, 30) }
}
