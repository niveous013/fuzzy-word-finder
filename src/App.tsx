import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { findCandidates } from './lib/candidates'
import { addLocalHistory, clearLocalHistory, preferencesFromHistory, readLocalHistory, removeLocalHistory } from './lib/history'
import { lookupTerm } from './services/dictionary'
import type { Candidate, ClueId, DictionaryEntry, HistoryItem } from './types'

const CLUES: { id: ClueId; label: string }[] = [
  { id: 'vowel', label: '元音没听清' }, { id: 'ending', label: '辅音或尾音没听清' },
  { id: 'silent', label: '可能有不发音字母' }, { id: 'double', label: '可能有重复字母' },
  { id: 'wordForm', label: '不确定单复数、时态等词形' },
]

const DOMAIN_OPTIONS = ['general', 'technology', 'business', 'education', 'health', 'science', 'travel']
const DOMAIN_LABEL: Record<string, string> = { general: '日常', technology: '科技', business: '商务', education: '教育', health: '健康', science: '科学', travel: '旅行' }

export default function App() {
  const [query, setQuery] = useState('')
  const [clues, setClues] = useState<ClueId[]>([])
  const [context, setContext] = useState('')
  const [domain, setDomain] = useState('general')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<DictionaryEntry | null>(null)
  const [status, setStatus] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>(readLocalHistory)
  const [showHistory, setShowHistory] = useState(false)

  const preferences = useMemo(() => preferencesFromHistory(history), [history])

  function search(event?: FormEvent) {
    event?.preventDefault()
    setSelected(null)
    const result = findCandidates({ query, clues, context, domain, preferences })
    setCandidates(result)
    setStatus(result.length ? `找到 ${result.length} 个可能的拼写。` : '暂时没有足够接近的候选；请补充语境或换一种猜测拼写。')
  }

  function toggleClue(id: ClueId) {
    setClues((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function selectCandidate(candidate: Candidate) {
    setStatus(`正在查询 “${candidate.term}” 的词典信息…`)
    try {
      const entry = await lookupTerm(candidate.term)
      setSelected(entry)
      const item = addLocalHistory({ query, selectedTerm: candidate.term, domain })
      setHistory((current) => [item, ...current])
      setStatus('已找到词典信息。你也可以继续调整听辨线索重新搜索。')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '查询时发生网络异常，请稍后再试。')
    }
  }

  function deleteHistoryItem(item: HistoryItem) { setHistory(removeLocalHistory(item.id)) }

  return <main className="shell">
    <header className="hero">
      <p className="eyebrow">FUZZY WORD FINDER</p>
      <h1>听到一个英文词，<em>不确定怎么拼？</em></h1>
      <p>输入你猜到的拼写。我们会给出可能的词，并解释它们为什么相近。</p>
    </header>

    <section className="panel search-panel" aria-labelledby="search-title">
      <h2 id="search-title">从你的猜测开始</h2>
      <form onSubmit={search}>
        <label htmlFor="query">我听到的词，大概拼作</label>
        <div className="search-row">
          <input id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：becos、nolej、look foward to" autoComplete="off" />
          <button type="submit">找候选</button>
        </div>
      </form>
      <div className="clue-area">
        <span>可能的听辨线索（可多选）</span>
        <div className="chips">{CLUES.map((clue) => <button type="button" className={clues.includes(clue.id) ? 'chip active' : 'chip'} onClick={() => toggleClue(clue.id)} key={clue.id}>{clue.label}</button>)}</div>
      </div>
      <div className="context-grid">
        <label>大致领域<select value={domain} onChange={(event) => setDomain(event.target.value)}>{DOMAIN_OPTIONS.map((option) => <option value={option} key={option}>{DOMAIN_LABEL[option]}</option>)}</select></label>
        <label>还想起什么语境？<input value={context} onChange={(event) => setContext(event.target.value)} placeholder="例如：它出现在编程教程里" /></label>
      </div>
      <p className="privacy-note">语境只用于本次排序，不会自动保存到云端。请不要输入隐私信息。</p>
    </section>

    {status && <p className="status" role="status">{status}</p>}
    {candidates.length > 0 && <section className="results" aria-labelledby="result-title"><div className="section-heading"><h2 id="result-title">可能是这些词</h2><span>按接近程度排序</span></div>{candidates.map((candidate, index) => <article className="candidate" key={candidate.term}><div className="rank">{index + 1}</div><div className="candidate-copy"><h3>{candidate.term} {candidate.isPhrase && <small>常见短语</small>}</h3><div className="tags">{candidate.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div></div><button className="secondary" onClick={() => void selectCandidate(candidate)}>查看词义</button></article>)}</section>}

    {selected && <section className="panel dictionary" aria-live="polite"><div className="word-heading"><div><p className="eyebrow">你选的是</p><h2>{selected.word}</h2><p className="phonetic">{selected.phonetic ?? '暂未提供音标'}</p></div>{selected.audio && <audio controls src={selected.audio}>浏览器不支持音频播放。</audio>}</div>{selected.chinese && <p className="translation"><strong>{selected.isMachineTranslation ? '机器翻译短释义：' : '中文短释义：'}</strong>{selected.chinese}</p>}{selected.isMachineTranslation && <p className="notice">这是机器翻译，不能替代词典定义。</p>}{selected.meanings.length ? selected.meanings.map((meaning) => <div className="meaning" key={meaning.partOfSpeech}><h3>{meaning.partOfSpeech}</h3>{meaning.definitions.map((definition) => <p key={definition}>{definition}</p>)}{meaning.example && <blockquote>“{meaning.example}”</blockquote>}</div>) : <p>这个短语暂时没有可显示的公开词典条目。</p>}</section>}

    <section className="two-column"><div className="panel"><div className="section-heading"><h2>本机查询记录</h2><button className="text-button" onClick={() => setShowHistory((current) => !current)}>{showHistory ? '收起' : '查看'}</button></div>{showHistory && <>{history.length ? <ul className="history">{history.map((item) => <li key={item.id}><div><strong>{item.query}</strong> → {item.selectedTerm}<small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small></div><button className="text-button" onClick={() => deleteHistoryItem(item)}>删除</button></li>)}</ul> : <p>还没有记录。选中一个候选后会保存在这台电脑。</p>}<button className="danger" onClick={() => { clearLocalHistory(); setHistory([]) }}>清除本机记录</button></>}</div>
      <div className="panel"><h2>你的隐私</h2><p>本工具不要求注册，也不会把查询记录上传到服务器。已选中的词只会保存在当前浏览器，用来让候选排序更贴近你的习惯。</p><p className="privacy-note">清除本机记录后，个人化偏好也会一并移除。语境仅用于当前查询，不会保存。</p></div></section>
  </main>
}
