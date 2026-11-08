import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { searchCandidates } from './lib/candidates'
import { guessPronunciation, ipaToPhones } from './lib/phonetics'
import { addLocalHistory, clearLocalHistory, PATTERN_LABEL, preferencesFromHistory, readLocalHistory, removeLocalHistory } from './lib/history'
import { DOMAIN_LABEL } from './data/lexicon'
import { lookupTerm } from './services/dictionary'
import type { Candidate, ClueId, DictionaryEntry, HistoryItem, SearchInput, SearchResult } from './types'

const CLUES: { id: ClueId; label: string }[] = [
  { id: 'vowel', label: '元音没听清' }, { id: 'ending', label: '辅音或尾音没听清' },
  { id: 'silent', label: '可能有不发音字母' }, { id: 'double', label: '可能有重复字母' },
  { id: 'wordForm', label: '不确定单复数、时态等词形' },
]
type Feedback = NonNullable<SearchInput['feedback']>[number]
const FEEDBACK: { id: Feedback; label: string; help: string }[] = [
  { id: 'vowel', label: '元音不对', help: '例如 /iː/ 与 /ɪ/、/æ/ 与 /ɛ/，可直接修改下方音标。' },
  { id: 'consonant', label: '辅音／尾音不对', help: '例如 /θ/ 与 /s/、/ð/ 与 /z/、/r/ 与 /l/；选中后会放宽这些匹配。' },
  { id: 'stress', label: '重音不对', help: '把 ˈ 放到你听到的重读音节前；模型也会尝试不同重音。' },
  { id: 'syllable', label: '音节数量不对', help: '可补充“听起来有三个音节”等语境；模型会尝试漏听的弱读音节。' },
]
interface RefinedResult extends SearchResult { llm?: 'ok' | 'unconfigured' | 'failed'; modelPronunciation?: string; message?: string }

export default function App() {
  const [query, setQuery] = useState('')
  const [clues, setClues] = useState<ClueId[]>([])
  const [context, setContext] = useState('')
  const [domain, setDomain] = useState('')
  const [useAI, setUseAI] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [session, setSession] = useState<SearchInput | null>(null)
  const [shown, setShown] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<DictionaryEntry | null>(null)
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [correctedIPA, setCorrectedIPA] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>(readLocalHistory)
  const [showHistory, setShowHistory] = useState(false)
  const requestId = useRef(0)
  const preferences = useMemo(() => preferencesFromHistory(history), [history])
  const visibleDomains = Object.entries(preferences.domainCounts ?? {}).sort((a, b) => b[1] - a[1])

  async function run(input: SearchInput, append = false) {
    const id = ++requestId.current
    setBusy(true); setSelected(null); setViewing(null); setConfirmed(false)
    setStatus(useAI ? '正在结合读音、线索和学习摘要检索…' : '正在比较读音…')
    let next: RefinedResult = searchCandidates(input)
    if (useAI) {
      try {
        const response = await fetch('/api/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, preferences: { ...input.preferences, selectedTerms: [] } }), signal: AbortSignal.timeout(22000) })
        if (!response.ok) throw new Error('模型接口暂时不可用')
        const remote = await response.json() as RefinedResult
        if (!Array.isArray(remote.candidates) || !remote.pronunciation) throw new Error('模型接口返回格式错误')
        next = { ...remote, pronunciation: remote.modelPronunciation ? guessPronunciation(input.query, remote.modelPronunciation) : remote.pronunciation }
      } catch { next.message = '模型接口不可用或超时，已回退到本机读音检索。' }
    }
    if (id !== requestId.current) return
    const combined = append ? [...shown, ...next.candidates.filter(item => !shown.some(old => old.term === item.term))] : next.candidates
    setShown(combined); setResult(next); setSession(input)
    setCorrectedIPA(input.pronunciation || next.pronunciation.ipa)
    setStatus(`${next.message ?? '按推测读音完成检索。'} 已显示 ${combined.length} 个候选${next.hasMore ? '，可以继续查看' : '；本轮接近的候选已显示完'}。`)
    setBusy(false)
  }
  function search(event: FormEvent) {
    event.preventDefault()
    if (!/^[a-zA-Z\s'-]{2,80}$/.test(query.trim()) || query.replace(/[^a-z]/gi, '').length < 2) { setStatus('请输入 2–80 个英文字符。'); return }
    setFeedbackOpen(false); setFeedback([])
    void run({ query: query.trim(), clues, context, domain, preferences })
  }
  function continueSearch() {
    if (!session) return
    void run({ ...session, preferences, exclude: shown.map(item => item.term), offset: 0 }, true)
  }
  function refine(event: FormEvent) {
    event.preventDefault()
    if (!session || !result) return
    if (correctedIPA && !ipaToPhones(correctedIPA).length) { setStatus('暂时无法识别这个音标；请只填英文 IPA，或清空后按线索重新推测。'); return }
    const changed = correctedIPA !== result.pronunciation.ipa && correctedIPA !== ''
    void run({ ...session, clues, context, domain, feedback, pronunciation: changed ? correctedIPA : undefined, offset: 0, exclude: [], preferences })
    if (!useAI && !changed && feedback.length) setStatus('已按反馈放宽匹配；仅选择类别无法确定新的读音，可修改具体音标或启用模型。')
  }
  async function viewCandidate(candidate: Candidate) {
    const id = ++requestId.current
    setBusy(true); setViewing(null); setSelected(null); setConfirmed(false)
    setStatus(`正在查看 “${candidate.term}” 的词义（尚未加入学习记录）…`)
    try {
      const entry = await lookupTerm(candidate.term)
      if (id !== requestId.current) return
      setSelected(entry); setViewing(candidate); setStatus('请核对词义和读音；确定后点“确认就是这个词”，才会加入学习记录。')
    } catch (error) { if (id === requestId.current) setStatus(error instanceof Error ? error.message : '词典网络异常，请稍后再试。') }
    finally { if (id === requestId.current) setBusy(false) }
  }
  function confirmWord() {
    if (!viewing || !session || confirmed) return
    try {
      addLocalHistory({ query: session.query, selectedTerm: viewing.term, domain: session.domain, domains: viewing.domains })
      setHistory(readLocalHistory()); setConfirmed(true); setStatus('已确认。拼写差异与可能领域已更新到本机学习档案。')
    } catch { setStatus('浏览器不允许保存记录；本次查词仍可使用。') }
  }
  function clearHistory() {
    try { clearLocalHistory(); setHistory([]); setStatus('本机记录、拼写混淆和领域偏好已清除。') }
    catch { setStatus('浏览器不允许清除本机存储，请检查浏览器权限。') }
  }
  return <main className="shell">
    <header className="hero"><p className="eyebrow">FUZZY WORD FINDER</p><h1>听到一个英文词，<em>不确定怎么拼？</em></h1><p>按你听到的声音试着拼。先推测读音，再找接近的单词；不合适时，我们一起纠正读音。</p></header>
    <section className="panel search-panel" aria-labelledby="search-title">
      <h2 id="search-title">从你听到的声音开始</h2>
      <form onSubmit={search}><label htmlFor="query">我听到的词，大概拼作</label><div className="search-row"><input id="query" maxLength={80} required value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：breeth、becos、nolej" autoComplete="off" /><button disabled={busy} type="submit">{busy ? '查询中…' : '找候选'}</button></div></form>
      <div className="clue-area"><span>可能的听辨线索（可多选，选好后重新搜索）</span><div className="chips">{CLUES.map(clue => <button disabled={busy} type="button" aria-pressed={clues.includes(clue.id)} className={clues.includes(clue.id) ? 'chip active' : 'chip'} onClick={() => setClues(current => current.includes(clue.id) ? current.filter(item => item !== clue.id) : [...current, clue.id])} key={clue.id}>{clue.label}</button>)}</div></div>
      <div className="context-grid"><label>大致领域<select value={domain} onChange={event => setDomain(event.target.value)}><option value="">未选择，让系统参考学习记录</option>{Object.entries(DOMAIN_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>还想起什么语境？<input maxLength={500} value={context} onChange={event => setContext(event.target.value)} placeholder="例如：医生说的，像是和呼吸有关" /></label></div>
      <label className="ai-toggle"><input type="checkbox" checked={useAI} disabled={busy} onChange={event => setUseAI(event.target.checked)} />使用模型辅助检索</label>
      <p className="privacy-note">模型可以结合语境和你的拼写习惯，尝试找到更多可能的词；结果仍需核对。</p>
      <p className="privacy-note">{useAI ? '本次拼写、音标、语境、线索和学习统计摘要会通过网站服务器发送给模型服务；不会发送原始查询历史。' : '当前使用本机读音检索；学习记录保存在此浏览器。'} 语境不会写入学习记录。</p>
      <details className="method-note"><summary>它怎样理解中文使用者的听音拼写？</summary><p>按自然拼读推测音素，再比较词表中的美式读音。考虑长短元音、弱读、th/s/z、r/l、v/w、n/l 和尾音等可能混淆；这些是可选的匹配规则，不代表每个人都有这些习惯。</p><p>离线词表约 9,400 个词。未知拼写的音标只是规则推测，可能有多种读法；模型也可能判断错误。先看词义，再确认正确答案。</p></details>
    </section>
    {status && <p className="status" role="status">{status}</p>}
    {result && session && <>
      <section className="panel pronunciation"><div className="section-heading"><h2>“{session.query}” 的推测读音</h2><span>{result.pronunciation.source === 'dictionary' ? '离线发音词表' : '待你核对的读音假设'}</span></div><p className="ipa">/{correctedIPA || result.pronunciation.ipa}/</p><p className="privacy-note">这不是录音识别结果。若与你听到的不同，请调整下方音标或补充反馈。</p></section>
      <section className="results" aria-labelledby="result-title"><div className="section-heading"><h2 id="result-title">可能是这些词</h2><span>读音优先，学习偏好少量加权</span></div>
        {shown.length ? shown.map((candidate, index) => <article className="candidate" key={candidate.term}><div className="rank">{index + 1}</div><div className="candidate-copy"><h3>{candidate.term} {candidate.isPhrase && <small>短语</small>}</h3>{candidate.phonetic && <p className="phonetic">/{candidate.phonetic}/</p>}<div className="tags">{candidate.reasons.map(reason => <span key={reason}>{reason}</span>)}</div></div><button disabled={busy} className="secondary" onClick={() => void viewCandidate(candidate)}>查看词义</button></article>) : <p>没有足够接近的候选。请检查推测读音，或补充语境；我们不会用无关的词凑数。</p>}
        <div className="result-actions"><button disabled={busy || (!result.hasMore && !useAI)} className="secondary" onClick={continueSearch}>{result.hasMore || useAI ? '继续检索其他候选' : '本轮候选已显示完'}</button><button disabled={busy} className="text-button" onClick={() => setFeedbackOpen(true)}>都不是，核对读音和语境</button></div>
      </section>
      {feedbackOpen && <section className="panel feedback"><h2>这个推测读音和你听到的一样吗？</h2><p>如果一样，可以补充句子或领域后再检索；如果不一样，指出哪里需要调整。</p><div className="chips">{FEEDBACK.map(item => <button type="button" key={item.id} disabled={busy} aria-pressed={feedback.includes(item.id)} className={feedback.includes(item.id) ? 'chip active' : 'chip'} onClick={() => setFeedback(current => current.includes(item.id) ? current.filter(value => value !== item.id) : [...current, item.id])}>{item.label}</button>)}</div>{FEEDBACK.filter(item => feedback.includes(item.id)).map(item => <p className="privacy-note" key={item.id}>{item.help}</p>)}
        <form onSubmit={refine}><label htmlFor="corrected-ipa">调整推测音标（可选；不会音标也可只选择上面的类别）</label><input id="corrected-ipa" value={correctedIPA} maxLength={100} onChange={event => setCorrectedIPA(event.target.value)} placeholder="例如 briːð" />
          <div className="context-grid"><label>补充领域<select value={domain} onChange={event => setDomain(event.target.value)}><option value="">尚不确定</option>{Object.entries(DOMAIN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>补充句子、含义或音节线索<input maxLength={500} value={context} onChange={event => setContext(event.target.value)} placeholder="例如：有两个音节，出现在生物课上" /></label></div><button disabled={busy} type="submit">根据修正重新检索</button>
        </form><p className="privacy-note">本机模式按具体音标和元音／辅音反馈调整匹配；重音、音节和自由文本的进一步推理建议启用模型辅助。</p>
      </section>}
    </>}
    {selected && viewing && <section className="panel dictionary" aria-live="polite"><div className="word-heading"><div><p className="eyebrow">先核对，再确认</p><h2>{selected.word}</h2><p className="phonetic">{selected.phonetic ?? '暂未提供音标'}</p></div>{selected.audio && <audio controls src={selected.audio}>浏览器不支持音频播放。</audio>}</div>{selected.chinese && <p className="translation"><strong>{selected.isMachineTranslation ? '机器翻译短释义：' : '中文短释义：'}</strong>{selected.chinese}</p>}{selected.isMachineTranslation && <p className="notice">机器翻译不能替代词典定义。</p>}{selected.meanings.length ? selected.meanings.map((meaning, index) => <div className="meaning" key={`${meaning.partOfSpeech}-${index}`}><h3>{meaning.partOfSpeech}</h3>{meaning.definitions.map(definition => <p key={definition}>{definition}</p>)}{meaning.example && <blockquote>{meaning.example}</blockquote>}</div>) : <p>这个短语暂时没有可显示的公开词典条目。</p>}<button className="confirm-word" disabled={confirmed} onClick={confirmWord}>{confirmed ? '已加入本机学习记录' : '确认就是这个词，记录这次拼写'}</button></section>}
    <section className="panel learning" aria-labelledby="learning-title"><div className="section-heading"><h2 id="learning-title">我的听音拼写档案</h2><span>仅从已确认的答案学习</span></div><p className="privacy-note">按字母差异和位置归类；不发音标签仅是有限规则推测，字母对齐也可能有多种结果。只在此浏览器保存最近 200 条记录；删除历史会重新计算统计。</p><div className="learning-grid">{Object.entries(PATTERN_LABEL).map(([kind, label]) => <div key={kind}><h3>{label}</h3>{preferences.patterns?.some(item => item.kind === kind) ? <ul>{preferences.patterns.filter(item => item.kind === kind).map(item => <li key={`${item.from}:${item.to}:${(item.details ?? []).join(',')}`}><div><code>{item.from || '∅'} → {item.to || '∅'}</code>{item.details?.length ? <small className="pattern-details">{item.details.join(' · ')}</small> : null}</div><span>{item.count} 次</span></li>)}</ul> : <p className="privacy-note">尚未记录</p>}</div>)}</div><h3>确认词汇可能涉及的领域</h3>{visibleDomains.length ? <div className="domain-bars">{visibleDomains.map(([key, count]) => <div key={key}><span>{DOMAIN_LABEL[key] ?? key}</span><meter min={0} max={Math.max(...visibleDomains.map(([, amount]) => amount))} value={count} /><span>{count} 次</span></div>)}</div> : <p className="privacy-note">暂时没有可归纳的领域。即使不手动选择，也会参考词表标签或模型建议归纳；无法判断的词不强行归类。</p>}<p className="privacy-note">领域可能重叠，仅作为下次排序的轻量参考；启用模型时，将这些统计摘要一并提供。</p></section>
    <section className="two-column"><div className="panel"><div className="section-heading"><h2>本机查询记录</h2><button className="text-button" aria-expanded={showHistory} onClick={() => setShowHistory(current => !current)}>{showHistory ? '收起' : '查看'}</button></div>{showHistory && (history.length ? <ul className="history">{history.map(item => <li key={item.id}><div><strong>{item.query}</strong> → {item.selectedTerm}<small>{new Date(item.createdAt).toLocaleString('zh-CN')}{!item.confirmed && ' · 旧版查看记录，未纳入学习'}</small></div><button className="text-button" onClick={() => { try { setHistory(removeLocalHistory(item.id)) } catch { setStatus('无法删除，请检查浏览器存储权限。') } }}>删除</button></li>)}</ul> : <p>尚无记录。查看词义后，确认正确答案即可积累。</p>)}<button className="danger" onClick={clearHistory}>清除记录与学习档案</button></div><div className="panel"><h2>你的隐私</h2><p>无需账号，历史和偏好只保存在当前浏览器。语境不保存。查词时会请求公开词典和翻译服务。</p><p className="privacy-note">只有勾选模型辅助时，本次输入和学习摘要才会经服务器发给配置的模型服务商。清除本机记录不会删除此前服务商可能保留的请求。</p></div></section>
  </main>
}
