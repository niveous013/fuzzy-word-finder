import { inferDomains, LEXICON } from '../data/lexicon'
import { PRONUNCIATIONS } from '../data/pronunciations'
import { bare, guessPronunciation, phoneticDistance, phonesToIPA, PRONUNCIATION_MAP, revisePronunciation } from './phonetics'
import type { Candidate, SearchInput, SearchResult } from '../types'
import { spellingChanges } from './history'

const vowelPattern = /[aeiouy]+/g
export function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z\s'-]/g, '').replace(/\s+/g, ' ')
}
export function editDistance(first: string, second: string): number {
  const row = Array.from({ length: second.length + 1 }, (_, index) => index)
  for (let i = 1; i <= first.length; i++) {
    let diagonal = row[0]; row[0] = i
    for (let j = 1; j <= second.length; j++) {
      const previous = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(first[i - 1] !== second[j - 1]))
      diagonal = previous
    }
  }
  return row[second.length]
}
export function soundKey(value: string): string { return guessPronunciation(normalize(value)).phones.map(bare).join(' ') }
const entries = new Map(PRONUNCIATIONS.map(([term, phones, frequency]) => [term, { term, phones: phones.split(' '), frequency, domains: inferDomains(term) }]))
for (const entry of LEXICON) entries.set(entry.term, { ...entry, domains: inferDomains(entry.term), phones: PRONUNCIATION_MAP.get(entry.term) ?? entry.term.split(' ').flatMap(word => guessPronunciation(word).phones) })

function explain(query: string, term: string, similarity: number): string[] {
  if (query === term) return ['拼写完全一致']
  const reasons: string[] = []
  if (similarity >= .7) reasons.push('推测读音相近（包含常见音素混淆）')
  if (query.replace(vowelPattern, '') === term.replace(vowelPattern, '')) reasons.push('元音组合可能没有听清')
  if (term.startsWith(query) && term.length > query.length) reasons.push(`可能漏写结尾 “${term.slice(query.length)}”`)
  else if (query.startsWith(term) && query.length > term.length) reasons.push(`可能多写结尾 “${query.slice(term.length)}”`)
  else if (term.length > query.length && editDistance(query, term) === term.length - query.length) reasons.push('可能漏写字母')
  else if (query.length > term.length && editDistance(query, term) === query.length - term.length) reasons.push('可能多写字母')
  if (/^kn|^wr|mb$|ght|^ps/.test(term)) reasons.push('候选含常见不发音字母')
  if (/(.)\1/.test(term) && term.replace(/(.)\1/g, '$1') === query.replace(/(.)\1/g, '$1')) reasons.push('可能混淆了双写字母')
  return reasons.length ? reasons : ['部分音素或字母接近，请核对读音']
}
export function searchCandidates(input: SearchInput): SearchResult {
  const query = normalize(input.query).slice(0, 80)
  const initial = guessPronunciation(query, input.pronunciation)
  const pronunciation = !input.pronunciation && input.feedback?.length ? revisePronunciation(initial, input.feedback) : initial
  if (query.replace(/[^a-z]/g, '').length < 2) return { candidates: [], total: 0, hasMore: false, pronunciation }
  const relaxedVowels = input.clues.includes('vowel') || input.feedback?.includes('vowel')
  const relaxedConsonants = input.clues.includes('ending') || input.feedback?.includes('consonant')
  const context = `${input.context ?? ''} ${input.domain ?? ''}`.toLowerCase()
  const contextDomains = inferDomains(normalize(input.context ?? ''))
  const hints: Record<string, RegExp> = { technology: /编程|程序|代码|电脑|软件|server|code|program/, health: /医生|呼吸|健康|医院|治疗|病|doctor|medical|breath/, science: /科学|生物|物理|化学|实验|biology|physics/, education: /学校|课程|老师|学习|教育|课堂|lesson|school/, business: /商业|商务|公司|投资|经济|合同|business|finance/, travel: /旅行|旅游|酒店|机票|机场|hotel|flight/ }
  for (const [domain, rule] of Object.entries(hints)) if (rule.test(context)) contextDomains.push(domain)
  const excluded = new Set(input.exclude ?? [])
  const ranked: Candidate[] = []
  for (const entry of entries.values()) {
    if (excluded.has(entry.term)) continue
    const spelling = 1 - editDistance(query, entry.term) / Math.max(query.length, entry.term.length)
    const sound = Math.max(0, 1 - phoneticDistance(pronunciation.phones, entry.phones, relaxedVowels, relaxedConsonants) / Math.max(pronunciation.phones.length, entry.phones.length, 1))
    if (sound < .61 && spelling < .78) continue
    if (spelling < .3 && sound < .85) continue
    let score = sound * 72 + spelling * 23 + entry.frequency / 100
    if (relaxedVowels && query.replace(vowelPattern, '') === entry.term.replace(vowelPattern, '')) score += 6
    if (query === entry.term && !input.pronunciation) score += 25
    if (entry.domains.some(domain => context.includes(domain) || contextDomains.includes(domain))) score += 4
    if (input.preferences?.selectedTerms.includes(entry.term)) score += 1
    score += Math.min(2, entry.domains.reduce((total, domain) => total + Math.log2(1 + (input.preferences?.domainCounts?.[domain] ?? 0)), 0))
    if (input.preferences?.patterns?.length) {
      const changes = spellingChanges(query, entry.term)
      score += Math.min(2, changes.reduce((bonus, change) => {
        const pattern = input.preferences?.patterns?.find(item => item.kind === change.kind && item.from === change.from && item.to === change.to)
        return bonus + Math.log2(1 + (pattern?.count ?? 0)) * .4
      }, 0))
    }
    if (input.feedback?.includes('stress')) {
      const stress = input.pronunciation?.indexOf('ˈ') ?? -1
      if (stress >= 0 && phonesToIPA(entry.phones).indexOf('ˈ') === stress) score += 3
    }
    if (input.feedback?.includes('syllable')) score += .5 * Math.min(3, entry.phones.filter(phone => /^[AEIOU]/.test(phone)).length)
    if (input.clues.includes('silent') && /^kn|^wr|mb$|ght|^ps/.test(entry.term)) score += 2
    if (input.clues.includes('double') && /(.)\1/.test(entry.term)) score += 2
    if (input.clues.includes('wordForm') && /(s|ed|ing)$/.test(entry.term)) score += 2
    ranked.push({ term: entry.term, score: Math.round(score * 10) / 10, reasons: explain(query, entry.term, sound), isPhrase: entry.term.includes(' '), domains: entry.domains, phonetic: phonesToIPA(entry.phones), source: 'local' })
  }
  ranked.sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
  const offset = Math.max(0, Math.min(20000, input.offset ?? 0))
  const limit = Math.max(1, Math.min(40, input.limit ?? 8))
  return { pronunciation, candidates: ranked.slice(offset, offset + limit), total: ranked.length, hasMore: ranked.length > offset + limit }
}
export function findCandidates(input: SearchInput): Candidate[] { return searchCandidates(input).candidates }
