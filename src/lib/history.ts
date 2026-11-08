import type { HistoryItem, UserPreference } from '../types'

const HISTORY_KEY = 'fuzzy-word-finder-history'

export function readLocalHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryItem[] } catch { return [] }
}

export function addLocalHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): HistoryItem {
  const next = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  localStorage.setItem(HISTORY_KEY, JSON.stringify([next, ...readLocalHistory()].slice(0, 50)))
  return next
}

export function clearLocalHistory(): void { localStorage.removeItem(HISTORY_KEY) }

export function removeLocalHistory(id: string): HistoryItem[] {
  const next = readLocalHistory().filter((item) => item.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

export function preferencesFromHistory(items: HistoryItem[]): UserPreference {
  return {
    selectedTerms: [...new Set(items.map((item) => item.selectedTerm))],
    domains: [...new Set(items.map((item) => item.domain).filter((value): value is string => Boolean(value)))],
  }
}
