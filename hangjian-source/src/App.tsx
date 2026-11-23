import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addRec, alive, chapterHtml, createFirstChapter, createFirstProject, createProject,
  CURRENT_PROJECT_KEY, currentProjectId, db, DEFAULT_LAYOUT, delRec, deleteProject,
  detectEntries, dialogueRatio, FONT_STACK, listProjects,
  setMutationHook, setSetting, updRec, wordCount,
  type Chapter, type ChapterStatus, type Entry, type Note, type Project, type Thread,
} from './lib/db'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { Editor } from './components/Editor'
import { L, useLang } from './lib/i18n'
import { FUNCTIONS } from './lib/propp'
import { scheduleSync, startAutoSync, subscribeSync, type SyncStatus } from './sync/syncEngine'
import { TextInput } from './components/Field'
import { Cards } from './components/Cards'
import { Equation } from './components/Equation'
import { Codex } from './components/Codex'
import { Threads } from './components/Threads'
import { Notes } from './components/Notes'
import { Layout } from './components/Layout'
import { Backup } from './components/Backup'
import { Settings } from './components/Settings'
import { PoetryPanel, type AiSubTab } from './components/PoetryPanel'

type StoryTab = 'cards' | 'equation' | 'codex' | 'threads' | 'notes' | 'layout' | 'backup' | 'settings'
type Tab = StoryTab | AiSubTab

const STORY_TABS: { id: StoryTab; label: () => string }[] = [
  { id: 'cards', label: () => L('抽卡', 'カード') },
  { id: 'equation', label: () => L('方程式', '方程式') },
  { id: 'codex', label: () => L('設定集', '設定資料') },
  { id: 'threads', label: () => L('伏筆', '伏線') },
  { id: 'notes', label: () => L('素材', '素材') },
  { id: 'layout', label: () => L('版面', '組版') },
  { id: 'backup', label: () => L('備份', 'バックアップ') },
  { id: 'settings', label: () => L('同步', '同期') },
]

const AI_TABS: { id: AiSubTab; label: string }[] = [
  { id: 'lexicon', label: '詞彙庫' },
  { id: 'expand', label: 'AI 擴寫' },
  { id: 'coach', label: '盲點診斷' },
  { id: 'consistency', label: '設定追蹤' },
  { id: 'outline', label: '大綱精靈' },
]

const STATUS_LABEL: Record<ChapterStatus, () => string> = {
  draft: () => L('初稿', '初稿'),
  revising: () => L('修改中', '改稿中'),
  done: () => L('定稿', '決定稿'),
}

setMutationHook(() => scheduleSync())

function useSticky<T>(value: T | undefined, key?: string): T | undefined {
  const last = useRef<{ k?: string; v?: T }>({})
  if (value !== undefined) last.current = { k: key, v: value }
  return last.current.k === key ? last.current.v : undefined
}

export default function App() {
  const [pid, setPid] = useState<string | null>(null)
  const [cur, setCur] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('cards')
  const [focus, setFocus] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [drawer, setDrawer] = useState<'rail' | 'panel' | null>(null)
  const [renaming, setRenaming] = useState(false)
  useLang()
  const [saved, setSaved] = useState(true)
  const [sync, setSync] = useState<SyncStatus | null>(null)

  const edRef = useRef<TipTapEditor | null>(null)
  const wcRef = useRef<HTMLSpanElement>(null)
  const drRef = useRef<HTMLSpanElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const curRef = useRef<string | null>(null)
  const [mentionedText, setMentionedText] = useState('')

  useEffect(() => { currentProjectId().then(setPid); startAutoSync() }, [])

  async function switchProject(id: string) {
    await setSetting(CURRENT_PROJECT_KEY, id)
    setCur(null)
    setPid(id)
  }
  async function newProject() {
    const title = prompt(L('新作品叫什麼？', '新しい作品の題名は？'), L('未命名作品', '無題の作品'))
    if (title === null) return
    setCur(null)
    setPid(await createProject(title))
  }
  useEffect(() => subscribeSync(setSync), [])

  const projects = useLiveQuery(() => listProjects(), [], [] as Project[])
  const project = useSticky(useLiveQuery(() => (pid ? db.project.get(pid) : undefined), [pid]), pid ?? '')
  const chapters = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.chapters.where('projectId').equals(pid).toArray()).sort((a, b) => a.order - b.order) : [], [pid]), pid ?? '') ?? ([] as Chapter[])
  const entries = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.entries.where('projectId').equals(pid).toArray()) : [], [pid]), pid ?? '') ?? ([] as Entry[])
  const threads = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.threads.where('projectId').equals(pid).toArray()) : [], [pid]), pid ?? '') ?? ([] as Thread[])
  const notes = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.notes.where('projectId').equals(pid).toArray()).sort((a, b) => b.createdAt - a.createdAt) : [], [pid]), pid ?? '') ?? ([] as Note[])

  const settled = sync?.settled ?? false
  useEffect(() => {
    if (!settled) return
    if (!pid) { void createFirstProject().then(setPid); return }
    if (project && !chapters.length) void createFirstChapter(pid)
  }, [settled, pid, project, chapters])

  useEffect(() => {
    if (!chapters.length) return
    if (cur == null || !chapters.some((c) => c.id === cur)) setCur(chapters[0].id)
  }, [chapters, cur])
  const current = chapters.find((c) => c.id === cur)

  const onEditorReady = useCallback((ed: TipTapEditor) => { edRef.current = ed }, [])

  const onEditorUpdate = useCallback((html: string, text: string) => {
    if (wcRef.current) wcRef.current.textContent = `${wordCount(text)} 字`
    if (drRef.current) drRef.current.textContent = `會話 ${Math.round(dialogueRatio(text) * 100)}%`
    setSaved(false)
    clearTimeout(saveTimer.current)
    const id = curRef.current
    if (!id) return
    saveTimer.current = setTimeout(() => {
      updRec(db.chapters, id, { html, text }).then(() => setSaved(true))
      setMentionedText(text)
    }, 600) as unknown as number
  }, [])

  useEffect(() => {
    if (!current) return
    curRef.current = current.id
    setMentionedText(current.text)
  }, [current])

  const mentioned = useMemo(() => new Set(detectEntries(mentionedText, entries).map((e) => e.id)), [mentionedText, entries])
  const total = useMemo(() => chapters.reduce((n, c) => n + wordCount(c.text), 0), [chapters])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') { e.preventDefault(); setFocus((v) => !v) }
      if (e.key === 'Escape') setDrawer(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  async function addChapter() {
    const id = await addRec(db.chapters, {
      projectId: pid!, order: chapters.length, title: `第${chapters.length + 1}章`,
      summary: '', text: '', html: '<p></p>', status: 'draft', func: null,
    })
    setCur(id)
  }
  async function move(id: string, d: number) {
    const i = chapters.findIndex((c) => c.id === id)
    const j = i + d
    if (i < 0 || j < 0 || j >= chapters.length) return
    const next = [...chapters]
    const [m] = next.splice(i, 1)
    next.splice(j, 0, m)
    await Promise.all(next.map((c, k) => (c.order === k ? null : updRec(db.chapters, c.id, { order: k }))))
  }
  async function removeChapter(id: string) {
    if (chapters.length <= 1) return
    if (!confirm(L('刪掉這一章？', 'この章を削除しますか。'))) return
    await delRec(db.chapters, id)
    const rest = chapters.filter((c) => c.id !== id)
    await Promise.all(rest.map((c, k) => (c.order === k ? null : updRec(db.chapters, c.id, { order: k }))))
    if (cur === id) setCur(rest[0]?.id ?? null)
  }
  function appendToChapter(t: string) {
    const ed = edRef.current
    if (!ed) return
    ed.chain().focus('end').insertContent(
      t.split('\n').filter((l) => l.trim()).map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] })),
    ).run()
    setDrawer(null)
  }
  function insertAtCursor(t: string) {
    const ed = edRef.current
    if (!ed) return
    ed.chain().focus().insertContent(t).run()
    setDrawer(null)
  }
  function getSelectedText() {
    const ed = edRef.current
    if (!ed) return ''
    const { from, to } = ed.state.selection
    return ed.state.doc.textBetween(from, to, ' ')
  }

  if (!pid || !project || !current) {
    return (
      <div className="empty" style={{ marginTop: 80 }}>
        {settled ? L('準備中…', '準備中…') : L('正在把雲端的稿子拉下來…', 'クラウドから原稿を取得しています…')}
      </div>
    )
  }

  const f = FUNCTIONS.find((x) => x.code === current.func)
  const Lp = { ...DEFAULT_LAYOUT, ...((project as Project).layout ?? {}) }
  const edStyle = {
    '--ed-font': FONT_STACK[Lp.font],
    '--ed-size': `${Lp.size}px`,
    '--ed-lh': String(Lp.lineHeight),
    '--ed-ls': `${Lp.letterSpacing}em`,
    '--ed-measure': `${Lp.measure}rem`,
    '--ed-indent': `${Lp.indent}em`,
  } as React.CSSProperties

  const isAiTab = AI_TABS.some((t) => t.id === tab)

  return (
    <>
      <div className={`scrim${drawer ? ' on' : ''}`} onClick={() => setDrawer(null)} />
      <div
        className={`app${focus ? ' focus' : ''}${!leftOpen ? ' left-collapsed' : ''}${!rightOpen ? ' right-collapsed' : ''}`}
        style={edStyle}
      >
        {/* 左側欄 */}
        <aside className={`rail${drawer === 'rail' ? ' open' : ''}`}>
          <div className="rail-brand">
            <div className="brand-mark" aria-hidden="true"><span /></div>
            <span className="brand-title">月下語詩</span>
            <button
              className="flat collapse-btn"
              title="收合左側欄"
              onClick={() => {
                setLeftOpen(false)
                setDrawer(null)
              }}
            >
              ‹
            </button>
          </div>

          <div className="rail-action">
            <button className="btn-new-chap" onClick={addChapter}>
              ＋ {L('新增章節', '章を足す')}
            </button>
          </div>

          <div className="rail-head">
            {renaming ? (
              <TextInput autoFocus aria-label={L('作品名稱', '作品名')} value={project.title}
                onCommit={(v) => updRec(db.project, project.id, { title: v.trim() || '未命名作品' })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRenaming(false) }}
                onBlur={() => setRenaming(false)} />
            ) : (
              <select aria-label={L('作品', '作品')} value={pid}
                onChange={(e) => (e.target.value === '__new' ? newProject() : switchProject(e.target.value))}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title || '未命名作品'}</option>)}
                <option value="__new">{L('＋ 新增作品…', '＋ 新しい作品…')}</option>
              </select>
            )}
            <button className="flat" title={renaming ? L('改好了', '完了') : L('改作品名稱', '作品名を変える')}
              onClick={() => setRenaming(!renaming)}>{renaming ? '✓' : '✎'}</button>
          </div>

          <div className="scroll">
            {chapters.map((c, i) => (
              <div key={c.id} className="chap" aria-current={c.id === cur} role="button" tabIndex={0}
                onClick={() => { setCur(c.id); setDrawer(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCur(c.id); setDrawer(null) } }}>
                <div className="chap-name">
                  <span className={`dot ${c.status}`} />
                  <span className="chap-num">{String(i + 1).padStart(2, '0')}</span>
                  <span>{c.title}</span>
                </div>
                <div className="chap-meta">
                  <span>{wordCount(c.text)}{L(' 字', ' 字')}</span>
                  {c.func && <span>・{c.func}</span>}
                  {c.id === cur && (
                    <>
                      <span style={{ flex: 1 }} />
                      <button className="flat" aria-label={L('上移', '上へ')} onClick={(e) => { e.stopPropagation(); move(c.id, -1) }}>↑</button>
                      <button className="flat" aria-label={L('下移', '下へ')} onClick={(e) => { e.stopPropagation(); move(c.id, 1) }}>↓</button>
                      <button className="flat danger" aria-label={L('刪除', '削除')} onClick={(e) => { e.stopPropagation(); removeChapter(c.id) }}>✕</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="panel-foot">
            <span className={`sync-dot ${sync?.state ?? 'unconfigured'}`} />
            <span style={{ flex: 1 }}>{L(`全稿 ${total} 字`, `全体 ${total} 字`)}</span>
            <span>{saved ? L('已存', '保存済み') : L('存檔中…', '保存中…')}</span>
          </div>
        </aside>

        {/* 中央工作區 */}
        <main className="main">
          <header className="floating-topbar">
            <button className="flat drawer-btn" aria-label={L('章節', '章')} onClick={() => setDrawer(drawer === 'rail' ? null : 'rail')}>≡</button>
            {!leftOpen && !focus && (
              <button className="flat pill-btn" title="展開左側欄" onClick={() => { setLeftOpen(true); setDrawer(null) }}>
                ☰ 目錄
              </button>
            )}
            <TextInput className="chap-title" aria-label={L('章節標題', '章の題名')} value={current.title}
              onCommit={(v) => updRec(db.chapters, current.id, { title: v })} />
            <span className="word-pill" ref={wcRef}>{wordCount(current.text)}{L(' 字', ' 字')}</span>
            <select className="pill-select" aria-label={L('狀態', '状態')} value={current.status}
              onChange={(e) => updRec(db.chapters, current.id, { status: e.target.value as ChapterStatus })}>
              {(Object.keys(STATUS_LABEL) as ChapterStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]()}</option>)}
            </select>
            <button className={`pill-btn${focus ? ' on' : ''}`} onClick={() => { setFocus(!focus); setDrawer(null) }}>
              {focus ? L('離開專注', '集中を抜ける') : L('專注', '集中')}
            </button>
            {!rightOpen && !focus && (
              <button className="pill-btn ai-reopen-btn" onClick={() => { setRightOpen(true); setDrawer(null) }}>
                ✨ 創作工具
              </button>
            )}
            <button className="flat drawer-btn" aria-label={L('面板', 'パネル')} onClick={() => setDrawer(drawer === 'panel' ? null : 'panel')}>▦</button>
          </header>

          <div className="summary-row">
            <span className="lbl">{L('本章摘要', 'この章のあらすじ')}</span>
            <TextInput placeholder={L('一句話講這章發生什麼事', 'この章で何が起きるかを一行で')} value={current.summary}
              onCommit={(v) => updRec(db.chapters, current.id, { summary: v })} />
            {f && <span className="tag seal">{f.code} {f.ja}</span>}
          </div>

          <Editor chapterId={current.id} html={chapterHtml(current)}
            onUpdate={onEditorUpdate} onReady={onEditorReady} />

          <div className="statusbar">
            <span ref={drRef}>
              {L('會話', '会話')} {Math.round(dialogueRatio(current.text) * 100)}%
            </span>
            <span className="grow" />
            <span>{L('⌘. 專注模式', '⌘. 集中モード')}</span>
          </div>
        </main>

        {/* 右側創作與 AI 工具面板 */}
        <aside className={`panel${drawer === 'panel' ? ' open' : ''}`}>
          <button
            className="right-collapse-circle"
            title="收合創作工具"
            aria-label="收合創作工具"
            onClick={() => {
              setRightOpen(false)
              setDrawer(null)
            }}
          >
            ›
          </button>

          <nav className="tabs-grid" role="tablist">
            <div className="tabs-row story-row">
              {STORY_TABS.map((t) => (
                <button key={t.id} className={`pill-tab${tab === t.id ? ' active' : ''}`} role="tab"
                  aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.label()}
                  {t.id === 'threads' && threads.some((x) => x.status === 'open') &&
                    <span className="badge-dot">·{threads.filter((x) => x.status === 'open').length}</span>}
                </button>
              ))}
            </div>
            <div className="tabs-row ai-row">
              {AI_TABS.map((t) => (
                <button key={t.id} className={`pill-tab ai-pill${tab === t.id ? ' active' : ''}`} role="tab"
                  aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </nav>

          {tab === 'cards' && <Cards projectId={pid} onAppend={appendToChapter} />}
          {tab === 'equation' && <Equation project={project as Project} chapters={chapters} entries={entries} />}
          {tab === 'codex' && <Codex projectId={pid} entries={entries} mentioned={mentioned} />}
          {tab === 'threads' && <Threads projectId={pid} threads={threads} chapters={chapters} currentId={current.id} />}
          {tab === 'notes' && <Notes projectId={pid} notes={notes} chapters={chapters} onInsert={insertAtCursor} />}
          {tab === 'layout' && (
            <Layout project={project as Project} projects={projects} onDelete={async (id) => {
              await deleteProject(id)
              const rest = projects.filter((p) => p.id !== id)
              setCur(null)
              setPid(rest.length ? rest[0].id : await createFirstProject())
            }} />
          )}
          {tab === 'backup' && <Backup project={project as Project} chapters={chapters} />}
          {tab === 'settings' && <Settings />}

          {isAiTab && (
            <PoetryPanel
              activeSubTab={tab as AiSubTab}
              onInsert={insertAtCursor}
              getSelectedText={getSelectedText}
              getCurrentChapterText={() => current?.text || ''}
            />
          )}
        </aside>
      </div>
    </>
  )
}