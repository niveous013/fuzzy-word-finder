import { PRONUNCIATIONS } from '../data/pronunciations'
import type { PronunciationGuess } from '../types'

export const PRONUNCIATION_MAP = new Map(PRONUNCIATIONS.map(([term, phones]) => [term, phones.split(' ')]))
const IPA: Record<string, string> = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', F: 'f', G: 'ɡ', HH: 'h', IH: 'ɪ', IY: 'iː', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', OW: 'oʊ', OY: 'ɔɪ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', UH: 'ʊ', UW: 'uː', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' }
export const bare = (phone: string) => phone.replace(/[012]/g, '')
export const isVowel = (phone: string) => /^[AEIOU]/.test(bare(phone))
export function phonesToIPA(phones: string[]): string {
  const parts = phones.map(phone => phone === 'AH0' ? 'ə' : phone === 'ER0' ? 'ɚ' : IPA[bare(phone)] ?? phone)
  if (phones.filter(isVowel).length > 1) {
    let previousVowel = -1
    phones.forEach((phone, index) => {
      if (!isVowel(phone)) return
      const onset = previousVowel < 0 ? 0 : Math.max(previousVowel + 1, index - 1)
      if (phone.endsWith('1') || phone.endsWith('2')) parts[onset] = `${phone.endsWith('1') ? 'ˈ' : 'ˌ'}${parts[onset]}`
      previousVowel = index
    })
  }
  return parts.join('')
}

export function ipaToPhones(ipa: string): string[] {
  const symbols = Object.entries(IPA).sort((a, b) => b[1].length - a[1].length)
  let rest = ipa.replace(/[\/\[\]\s.]/g, '').replace(/ɹ/g, 'r').replace(/ɜː/g, 'ɝ').replace(/ɒ/g, 'ɑ').replace(/əʊ/g, 'oʊ').replace(/e(?!ɪ)/g, 'ɛ').replace(/g/g, 'ɡ').replace(/i(?!ː)/g, 'iː').replace(/u(?!ː)/g, 'uː')
  const result: string[] = []
  let stress = ''
  while (rest) {
    if (rest[0] === 'ˈ' || rest[0] === 'ˌ') { stress = rest[0] === 'ˈ' ? '1' : '2'; rest = rest.slice(1); continue }
    if (rest.startsWith('ə')) { result.push('AH0'); rest = rest.slice(1); continue }
    if (rest.startsWith('ɚ')) { result.push('ER0'); rest = rest.slice(1); continue }
    const found = symbols.find(([, symbol]) => rest.startsWith(symbol))
    if (!found) return []
    result.push(found[0] + (isVowel(found[0]) ? stress : ''))
    if (isVowel(found[0])) stress = ''
    rest = rest.slice(found[1].length)
  }
  return result
}

export function revisePronunciation(guess: PronunciationGuess, feedback: string[] = []): PronunciationGuess {
  const phones = [...guess.phones]
  const pairs: Record<string, string> = { IY: 'IH', IH: 'IY', EH: 'AE', AE: 'EH', UW: 'UH', UH: 'UW', AA: 'AO', AO: 'AA', AH: 'AE', TH: 'DH', DH: 'TH', R: 'L', L: 'R', V: 'W', W: 'V', N: 'L', S: 'TH', Z: 'DH' }
  for (const kind of ['vowel', 'consonant']) {
    if (!feedback.includes(kind)) continue
    const index = phones.findIndex(phone => (kind === 'vowel') === isVowel(phone) && pairs[bare(phone)])
    if (index >= 0) phones[index] = pairs[bare(phones[index])]
  }
  if (feedback.includes('stress')) {
    const vowels = phones.map((phone, index) => isVowel(phone) ? index : -1).filter(index => index >= 0)
    const current = vowels.findIndex(index => phones[index].endsWith('1'))
    if (vowels.length > 1) {
      for (const index of vowels) phones[index] = bare(phones[index]) + '0'
      phones[vowels[(current + 1) % vowels.length]] = bare(phones[vowels[(current + 1) % vowels.length]]) + '1'
    }
  }
  if (feedback.includes('syllable')) phones.splice(Math.max(0, phones.length - 1), 0, 'AH0')
  return { phones, ipa: phonesToIPA(phones), source: 'rules' }
}

// 未知拼写只能推测，不把规则生成的 IPA 当成正确答案。
export function guessPronunciation(query: string, corrected?: string): PronunciationGuess {
  if (corrected) {
    const phones = ipaToPhones(corrected)
    if (phones.length) return { ipa: corrected.replace(/[\/\[\]]/g, ''), phones, source: 'user' }
  }
  const known = PRONUNCIATION_MAP.get(query)
  if (known) return { ipa: phonesToIPA(known), phones: known, source: 'dictionary' }
  const chunks: [RegExp, string[]][] = [
    [/^tion/, ['SH', 'AH0', 'N']], [/^sion/, ['ZH', 'AH0', 'N']], [/^tch/, ['CH']],
    [/^(ee|ea)/, ['IY']], [/^(ai|ay)/, ['EY']], [/^igh/, ['AY']], [/^ow/, ['OW']], [/^ou/, ['AW']], [/^oo/, ['UW']], [/^oi|^oy/, ['OY']],
    [/^ph/, ['F']], [/^th/, ['TH']], [/^sh/, ['SH']], [/^ch/, ['CH']], [/^ng/, ['NG']], [/^ck/, ['K']], [/^qu/, ['K', 'W']],
  ]
  const singles: Record<string, string> = { a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH', y: 'Y', b: 'B', c: 'K', d: 'D', f: 'F', g: 'G', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', r: 'R', s: 'S', t: 'T', v: 'V', w: 'W', x: 'K S', z: 'Z' }
  let rest = query.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/mb$/, 'm').replace(/([^aeiou])\1/g, '$1')
  const phones: string[] = []
  while (rest) {
    const magicE = rest.match(/^([aeiou])([b-df-hj-np-tv-z])e$/)
    if (magicE) {
      phones.push(({ a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW' } as Record<string, string>)[magicE[1]], ...singles[magicE[2]].split(' '))
      break
    }
    const match = chunks.map(([rule, sounds]) => ({ match: rest.match(rule), sounds })).find(item => item.match)
    if (match?.match) { phones.push(...match.sounds); rest = rest.slice(match.match[0].length) }
    else { if (singles[rest[0]]) phones.push(...singles[rest[0]].split(' ')); rest = rest.slice(1) }
  }
  return { ipa: phonesToIPA(phones), phones, source: 'rules' }
}

const confusions = [['TH', 'S', 'F'], ['DH', 'Z', 'D'], ['R', 'L'], ['V', 'W'], ['N', 'L'], ['IH', 'IY'], ['EH', 'AE'], ['UH', 'UW'], ['AA', 'AO'], ['B', 'P'], ['D', 'T'], ['G', 'K'], ['S', 'SH']]
export function phoneCost(a: string, b: string, relaxedVowels = false, relaxedConsonants = false): number {
  if (bare(a) === bare(b)) return 0
  if ([a, b].map(bare).sort().join() === 'DH,TH') return .25
  if ([a, b].map(bare).sort().join() === 'S,Z') return .3
  if (confusions.some(group => group.includes(bare(a)) && group.includes(bare(b)))) return .3
  if (isVowel(a) && isVowel(b)) return relaxedVowels ? .15 : .65
  if (!isVowel(a) && !isVowel(b) && relaxedConsonants) return .4
  return 1
}
export function phoneticDistance(a: string[], b: string[], relaxedVowels = false, relaxedConsonants = false): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i * .85)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]; row[0] = i * .85
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j]
      row[j] = Math.min(row[j] + .85, row[j - 1] + .85, diagonal + phoneCost(a[i - 1], b[j - 1], relaxedVowels, relaxedConsonants))
      diagonal = previous
    }
  }
  return row[b.length]
}
