import type { DictionaryEntry, DictionaryMeaning } from '../types'

interface FreeDictionaryEntry {
  word: string
  phonetic?: string
  phonetics?: { text?: string; audio?: string }[]
  meanings?: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[]
}

function mapEntry(entry: FreeDictionaryEntry): DictionaryEntry {
  const phonetic = entry.phonetic ?? entry.phonetics?.find((item) => item.text)?.text
  const audio = entry.phonetics?.find((item) => item.audio)?.audio
  const meanings: DictionaryMeaning[] = (entry.meanings ?? []).slice(0, 3).map((meaning) => ({
    partOfSpeech: meaning.partOfSpeech,
    definitions: meaning.definitions.slice(0, 2).map((definition) => definition.definition),
    example: meaning.definitions.find((definition) => definition.example)?.example,
  }))
  return { word: entry.word, phonetic, audio, meanings }
}

export async function lookupTerm(term: string): Promise<DictionaryEntry> {
  const response = await fetch('/api/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term }),
  })
  if (response.ok) return response.json() as Promise<DictionaryEntry>

  // 本地开发或尚未部署服务端函数时，仍可取得英文公开词典内容。
  if (term.includes(' ')) {
    return { word: term, meanings: [], chinese: '短语释义需要在部署后配置翻译服务。', isMachineTranslation: true }
  }
  const dictionaryResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`)
  if (!dictionaryResponse.ok) throw new Error('暂时找不到这个词的词典条目。')
  const entries = await dictionaryResponse.json() as FreeDictionaryEntry[]
  return mapEntry(entries[0])
}
