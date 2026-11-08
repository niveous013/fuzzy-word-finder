export type ClueId = 'vowel' | 'ending' | 'silent' | 'double' | 'wordForm'

export interface SearchInput {
  query: string
  clues: ClueId[]
  context?: string
  domain?: string
  preferences?: UserPreference
}

export interface Candidate {
  term: string
  score: number
  reasons: string[]
  isPhrase: boolean
  domains: string[]
}

export interface UserPreference {
  selectedTerms: string[]
  domains: string[]
}

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
}
