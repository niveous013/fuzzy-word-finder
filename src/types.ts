export type ClueId = 'vowel' | 'ending' | 'silent' | 'double' | 'wordForm'

export interface SearchInput {
  query: string
  clues: ClueId[]
  context?: string
  domain?: string
  preferences?: UserPreference
  pronunciation?: string
  feedback?: ('vowel' | 'consonant' | 'stress' | 'syllable')[]
  offset?: number
  limit?: number
  exclude?: string[]
}

export interface Candidate {
  term: string
  score: number
  reasons: string[]
  isPhrase: boolean
  domains: string[]
  phonetic?: string
  source?: 'local' | 'llm'
}

export interface UserPreference {
  selectedTerms: string[]
  domains: string[]
  patterns?: SpellingPattern[]
  domainCounts?: Record<string, number>
}

export type PatternKind = 'vowel' | 'consonant' | 'extra' | 'missing'
export interface SpellingPattern { kind: PatternKind; from: string; to: string; count: number; details?: string[] }
export interface PronunciationGuess { ipa: string; phones: string[]; source: 'dictionary' | 'rules' | 'user' }
export interface SearchResult { candidates: Candidate[]; total: number; hasMore: boolean; pronunciation: PronunciationGuess }

export interface DictionaryMeaning {
  partOfSpeech: string
  definitions: string[]
  example?: string
}

export interface DictionaryEntry {
  word: string
  phonetic?: string
  audio?: string
  meanings: DictionaryMeaning[]
  chinese?: string
  isMachineTranslation?: boolean
}

export interface HistoryItem {
  id: string
  query: string
  selectedTerm: string
  domain?: string
  createdAt: string
  domains?: string[]
  confirmed?: boolean
}
