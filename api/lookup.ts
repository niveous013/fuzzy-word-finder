import type { DictionaryEntry, DictionaryMeaning } from '../src/types'

interface FreeDictionaryEntry {
  word: string
  phonetic?: string
  phonetics?: { text?: string; audio?: string }[]
  meanings?: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[]
}

function mapEntry(entry: FreeDictionaryEntry): DictionaryEntry {
  const meanings: DictionaryMeaning[] = (entry.meanings ?? []).slice(0, 3).map((meaning) => ({
    partOfSpeech: meaning.partOfSpeech,
    definitions: meaning.definitions.slice(0, 2).map((definition) => definition.definition),
    example: meaning.definitions.find((definition) => definition.example)?.example,
  }))
  return {
    word: entry.word,
    phonetic: entry.phonetic ?? entry.phonetics?.find((item) => item.text)?.text,
    audio: entry.phonetics?.find((item) => item.audio)?.audio,
    meanings,
  }
}

async function translate(text: string): Promise<string | undefined> {
  const key = process.env.DEEPL_AUTH_KEY
  if (!key || !text) return undefined
  const body = new URLSearchParams({ auth_key: key, text, target_lang: 'ZH' })
  const response = await fetch('https://api-free.deepl.com/v2/translate', { method: 'POST', body })
  if (!response.ok) return undefined
  const data = await response.json() as { translations?: { text: string }[] }
  return data.translations?.[0]?.text
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const { term } = await request.json() as { term?: string }
  if (!term?.trim()) return Response.json({ error: '缺少 term。' }, { status: 400 })
  if (term.includes(' ')) {
    const chinese = await translate(term)
    return Response.json({ word: term, meanings: [], chinese: chinese ?? '翻译服务尚未配置或暂时不可用。', isMachineTranslation: true })
  }
  const dictionary = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`)
  if (!dictionary.ok) return Response.json({ error: '未找到词典条目。' }, { status: dictionary.status === 404 ? 404 : 502 })
  const entries = await dictionary.json() as FreeDictionaryEntry[]
  const entry = mapEntry(entries[0])
  entry.chinese = await translate(entry.meanings[0]?.definitions[0] ?? entry.word)
  return Response.json(entry)
}
