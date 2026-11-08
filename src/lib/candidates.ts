import { LEXICON } from '../data/lexicon'
import type { Candidate, SearchInput } from '../types'

const silentPatterns = ['kn', 'wr', 'mb', 'gh', 'bt', 'lm']
const vowelPattern = /[aeiouy]+/g

export function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z\s'-]/g, '').replace(/\s+/g, ' ')
}

export function editDistance(first: string, second: string): number {
  const row = Array.from({ length: second.length + 1 }, (_, index) => index)
  for (let i = 1; i <= first.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= second.length; j += 1) {
      const previous = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(first[i - 1] !== second[j - 1]))
      diagonal = previous
    }
  }
  return row[second.length]
}

// 简化读音键：不试图替代 IPA，只用于把常见拼写近音归到相近组。
export function soundKey(value: string): string {
  return normalize(value)
    .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'kw')
    .replace(/tion/g, 'shun').replace(/sion/g, 'zhun').replace(/ough/g, 'of')
    .replace(/(ee|ea)/g, 'i').replace(/(ai|ay)/g, 'e').replace(vowelPattern, 'a')
    .replace(/(.)\1+/g, '$1').replace(/[aeiouy]/g, '')
}

function explain(query: string, term: string, clues: SearchInput['clues']): string[] {
  const reasons: string[] = []
  if (query === term) reasons.push('拼写完全一致')
  if (Math.abs(query.length - term.length) > 0) reasons.push('可能漏掉或多写了字母')
  if (soundKey(query) === soundKey(term) && query !== term) reasons.push('按常见读音规则，拼写听起来相近')
  if (clues.includes('vowel') && query.replace(vowelPattern, '') === term.replace(vowelPattern, '')) reasons.push('元音组合可能没有听清')
  if (clues.includes('ending') && query.slice(0, -1) === term.slice(0, -1)) reasons.push('结尾音或结尾字母可能不清楚')
  if (clues.includes('silent') && silentPatterns.some((pattern) => term.includes(pattern))) reasons.push('这个词包含常见不发音字母组合')
  if (clues.includes('double') && /(.)\1/.test(term)) reasons.push('这个词可能有重复字母')
  if (clues.includes('wordForm') && /(?:ed|ing|s|es)$/.test(term)) reasons.push('词形变化可能影响了你听到的结尾')
  return reasons.length ? reasons : ['与输入拼写较接近']
}

export function findCandidates(input: SearchInput): Candidate[] {
  const query = normalize(input.query)
  if (query.length < 2) return []
  const querySound = soundKey(query)
  const context = normalize(`${input.context ?? ''} ${input.domain ?? ''}`)
  return LEXICON.map((entry) => {
    const distance = editDistance(query, entry.term)
    const maxLength = Math.max(query.length, entry.term.length)
    const spelling = Math.max(0, 1 - distance / Math.max(maxLength, 1)) * 72
    const phonetic = querySound && querySound === soundKey(entry.term) ? 13 : 0
    const domainMatch = entry.domains.some((domain) => context.includes(domain)) ? 8 : 0
    const preference = input.preferences?.selectedTerms.includes(entry.term) ? 5 : 0
    const preferredDomain = entry.domains.some((domain) => input.preferences?.domains.includes(domain)) ? 3 : 0
    const clueBonus = input.clues.length ? Math.min(4, explain(query, entry.term, input.clues).length) : 0
    return {
      term: entry.term,
      score: Math.round(spelling + phonetic + domainMatch + preference + preferredDomain + clueBonus + entry.frequency / 100),
      reasons: explain(query, entry.term, input.clues),
      isPhrase: entry.term.includes(' '),
      domains: entry.domains,
    }
  }).filter((candidate) => candidate.score >= 24)
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .slice(0, 8)
}
