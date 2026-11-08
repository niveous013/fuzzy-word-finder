export interface LexiconItem {
  term: string
  frequency: number
  domains: string[]
}

export const DOMAIN_LABEL: Record<string, string> = { general: '日常', technology: '科技', business: '商务', education: '教育', health: '健康', science: '科学', travel: '旅行' }
const DOMAIN_TERMS: Record<string, string[]> = {
  technology: ['algorithm', 'program', 'code', 'server', 'database', 'browser', 'network', 'application', 'interface', 'function', 'variable', 'debug', 'compile', 'deploy'],
  health: ['breathe', 'breath', 'breathing', 'respiration', 'lung', 'lungs', 'patient', 'hospital', 'doctor', 'disease', 'treatment', 'symptom', 'therapy', 'surgery', 'medical'],
  science: ['experiment', 'research', 'physics', 'biology', 'chemistry', 'neuron', 'synapse', 'neurology', 'hypothesis', 'molecule', 'energy', 'gravity'],
  business: ['profit', 'revenue', 'budget', 'finance', 'market', 'stock', 'company', 'investment', 'contract', 'meeting'],
  education: ['student', 'teacher', 'school', 'lesson', 'lecture', 'university', 'course', 'psychology', 'phonetic'],
  travel: ['airport', 'flight', 'hotel', 'ticket', 'passport', 'journey', 'destination', 'tourism', 'luggage'],
}
export function inferDomains(term: string): string[] {
  return [...new Set([...(LEXICON.find(entry => entry.term === term)?.domains ?? []), ...Object.entries(DOMAIN_TERMS).filter(([, words]) => words.includes(term)).map(([domain]) => domain)])].filter(domain => domain !== 'general')
}

// 第一版刻意保持词表小而可读；后续可替换成有授权的大词表。
export const LEXICON: LexiconItem[] = [
  ['about', 100, ['general']], ['accept', 76, ['general']], ['access', 80, ['technology']],
  ['account', 72, ['business']], ['actually', 77, ['general']], ['advice', 65, ['general']],
  ['affect', 55, ['general']], ['again', 86, ['general']], ['almost', 75, ['general']],
  ['answer', 82, ['general']], ['available', 71, ['technology']], ['because', 98, ['general']],
  ['beautiful', 69, ['general']], ['beginning', 63, ['general']], ['believe', 71, ['general']],
  ['business', 75, ['business']], ['calendar', 59, ['business']], ['camera', 64, ['technology']],
  ['character', 66, ['technology']], ['chemical', 55, ['science']], ['choose', 73, ['general']],
  ['clothes', 65, ['general']], ['comfortable', 55, ['general']], ['computer', 83, ['technology']],
  ['congratulations', 48, ['general']], ['conscious', 44, ['science']], ['conversation', 69, ['general']],
  ['create', 78, ['technology']], ['decision', 72, ['business']], ['different', 90, ['general']],
  ['dictionary', 52, ['education']], ['difficult', 75, ['general']], ['environment', 66, ['science']],
  ['especially', 68, ['general']], ['exercise', 67, ['education']], ['experience', 79, ['general']],
  ['familiar', 58, ['general']], ['foreign', 59, ['general']], ['friend', 88, ['general']],
  ['government', 67, ['business']], ['grammar', 57, ['education']], ['happened', 69, ['general']],
  ['healthy', 63, ['health']], ['history', 71, ['education']], ['important', 93, ['general']],
  ['information', 85, ['technology']], ['interest', 78, ['general']], ['island', 55, ['travel']],
  ['language', 78, ['education']], ['library', 63, ['education']], ['listen', 78, ['education']],
  ['medicine', 64, ['health']], ['message', 77, ['technology']], ['necessary', 63, ['general']],
  ['occasion', 48, ['general']], ['opportunity', 67, ['business']], ['people', 100, ['general']],
  ['physical', 64, ['health']], ['picture', 80, ['general']], ['practice', 75, ['education']],
  ['probably', 74, ['general']], ['receive', 69, ['business']], ['restaurant', 63, ['travel']],
  ['science', 68, ['science']], ['separate', 59, ['general']], ['serious', 66, ['general']],
  ['similar', 67, ['general']], ['situation', 75, ['general']], ['software', 66, ['technology']],
  ['special', 78, ['general']], ['temperature', 54, ['science']], ['through', 85, ['general']],
  ['together', 75, ['general']], ['tomorrow', 76, ['general']], ['travel', 70, ['travel']],
  ['usually', 76, ['general']], ['vacuum', 42, ['science']], ['vegetable', 58, ['health']],
  ['weather', 70, ['general']], ['welcome', 75, ['general']], ['women', 70, ['general']],
  ['work', 100, ['business']], ['would', 100, ['general']], ['write', 83, ['education']],
  ['a lot of', 86, ['general']], ['as soon as', 75, ['general']], ['by the way', 68, ['general']],
  ['for example', 75, ['general']], ['in front of', 72, ['general']], ['kind of', 75, ['general']],
  ['look forward to', 68, ['general']], ['once in a while', 45, ['general']], ['piece of cake', 40, ['general']],
  ['take care of', 70, ['general']], ['thank you', 95, ['general']], ['used to', 78, ['general']],
].map(([term, frequency, domains]) => ({ term: term as string, frequency: frequency as number, domains: domains as string[] }))
