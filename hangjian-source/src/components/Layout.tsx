import { useEffect, useState } from 'react'
import { db, DEFAULT_LAYOUT, updRec, type LayoutPrefs, type Project } from '../lib/db'
import { getLang, L, setLang } from '../lib/i18n'
import { TextInput } from './Field'

const FONTS: { id: LayoutPrefs['font']; label: () => string; note: () => string }[] = [
  { id: 'serif', label: () => L('宋體', '明朝'), note: () => L('預設。長篇閱讀最不累', '既定。長く読んでも疲れにくい') },
  { id: 'sans', label: () => L('黑體', 'ゴシック'), note: () => L('筆畫均勻，螢幕上清楚', '線が均一で、画面ではっきり見える') },
  { id: 'kai', label: () => L('楷體', '楷書'), note: () => L('像手寫稿。系統沒有的話會退回宋體', '手書き原稿のよう。無い環境では明朝に戻る') },
  { id: 'mono', label: () => L('等寬', '等幅'), note: () => L('每個字佔一格，方便數字數', '一字が一マス。文字数を数えやすい') },
]

interface ThemeColors {
  bg: string
  panel: string
  panel2: string
  ink: string
  seal: string
  line: string
}

interface ThemePreset {
  id: string
  name: () => string
  sub: () => string
  colors: ThemeColors
  isCustom?: boolean
}

const BUILTIN_THEMES: ThemePreset[] = [
  {
    id: 'night',
    name: () => L('月夜', '月夜'),
    sub: () => L('炭黑底色・琥珀微光', '炭黒ベース・琥珀の灯り'),
    colors: {
      bg: '#16181d',
      panel: '#1f2229',
      panel2: '#2c313c',
      ink: '#edeff5',
      seal: '#d99b66',
      line: '#363c48',
    },
  },
  {
    id: 'day',
    name: () => L('素宣', '素宣'),
    sub: () => L('書卷暖白・朱砂印泥', '和紙の白・朱肉アクセント'),
    colors: {
      bg: '#faf9f5',
      panel: '#f1efe9',
      panel2: '#e5e2d9',
      ink: '#242320',
      seal: '#b34b39',
      line: '#d6d2c6',
    },
  },
  {
    id: 'mist',
    name: () => L('煙雨', '煙雨'),
    sub: () => L('天青灰藍・清透校閱', '青磁グレー・爽やか校正'),
    colors: {
      bg: '#f0f4f7',
      panel: '#e4ecf2',
      panel2: '#d5e1eb',
      ink: '#1c2a36',
      seal: '#3b7396',
      line: '#c2d3e0',
    },
  },
  {
    id: 'cedar',
    name: () => L('竹影', '竹影'),
    sub: () => L('青苔護眼・靜謐山林', '苔グリーン・目に優しい森'),
    colors: {
      bg: '#f1f5f0',
      panel: '#e5ede3',
      panel2: '#d6e2d3',
      ink: '#1e2b20',
      seal: '#3f7a53',
      line: '#c3d4bf',
    },
  },
  {
    id: 'wheat',
    name: () => L('麥浪', '麦浪'),
    sub: () => L('復古羊皮・暖陽紙香', '羊皮紙・陽だまりの温もり'),
    colors: {
      bg: '#f6f0e3',
      panel: '#ede4d1',
      panel2: '#e0d3ba',
      ink: '#2d2419',
      seal: '#9c6334',
      line: '#d1c2a5',
    },
  },
  {
    id: 'deepsea',
    name: () => L('滄海', '滄海'),
    sub: () => L('午夜群青・深海沉浸', 'ミッドナイトブルー・深い集中'),
    colors: {
      bg: '#131d24',
      panel: '#1b2933',
      panel2: '#273a47',
      ink: '#e5eff5',
      seal: '#56a3b8',
      line: '#314756',
    },
  },
]

const STORAGE_THEME_ID = 'moonlight_active_theme_id'
const STORAGE_CUSTOM_COLORS = 'moonlight_custom_theme_colors'
const STORAGE_SAVED_CUSTOMS = 'moonlight_saved_custom_themes'

function applyThemeToDocument(c: ThemeColors) {
  const root = document.documentElement
  root.style.setProperty('--bg', c.bg)
  root.style.setProperty('--paper', c.bg)
  root.style.setProperty('--panel', c.panel)
  root.style.setProperty('--surface', c.panel)
  root.style.setProperty('--sidebar', c.panel)
  root.style.setProperty('--panel-2', c.panel2)
  root.style.setProperty('--panel-3', c.panel2)
  root.style.setProperty('--ink', c.ink)
  root.style.setProperty('--fg', c.ink)
  root.style.setProperty('--text', c.ink)
  root.style.setProperty('--seal', c.seal)
  root.style.setProperty('--accent', c.seal)
  root.style.setProperty('--line', c.line)
  root.style.setProperty('--border', c.line)
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="field">
      <label className="lbl">
        {label}
        <span style={{ float: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {Number.isInteger(value) ? value : value.toFixed(2)}{unit ?? ''}
        </span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export function Layout({ project, projects, onDelete }: {
  project: Project
  projects: Project[]
  onDelete: (id: string) => void
}) {
  const Lp = { ...DEFAULT_LAYOUT, ...(project.layout ?? {}) }
  const [armed, setArmed] = useState(false)
  const lang = getLang()
  const set = (patch: Partial<LayoutPrefs>) =>
    updRec(db.project, project.id, { layout: { ...Lp, ...patch } })

  const [activeThemeId, setActiveThemeId] = useState<string>(() => localStorage.getItem(STORAGE_THEME_ID) || 'day')
  const [savedCustoms, setSavedCustoms] = useState<{ id: string; name: string; colors: ThemeColors }[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SAVED_CUSTOMS)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const [currentColors, setCurrentColors] = useState<ThemeColors>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_COLORS)
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return BUILTIN_THEMES[1].colors
  })

  const [tweakOpen, setTweakOpen] = useState(false)

  useEffect(() => {
    applyThemeToDocument(currentColors)
  }, [currentColors])

  const allThemes: ThemePreset[] = [
    ...BUILTIN_THEMES,
    ...savedCustoms.map((c) => ({
      id: c.id,
      name: () => c.name,
      sub: () => L('自訂主題・專屬配色', 'カスタムテーマ'),
      colors: c.colors,
      isCustom: true,
    })),
  ]

  const currentThemeObj = allThemes.find((t) => t.id === activeThemeId) || BUILTIN_THEMES[1]

  const selectTheme = (t: ThemePreset) => {
    setActiveThemeId(t.id)
    setCurrentColors(t.colors)
    localStorage.setItem(STORAGE_THEME_ID, t.id)
    localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(t.colors))
    applyThemeToDocument(t.colors)
  }

  const tweakColor = (key: keyof ThemeColors, val: string) => {
    const next = { ...currentColors, [key]: val }
    setCurrentColors(next)
    localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(next))
    applyThemeToDocument(next)
  }

  const handleSaveAsMine = () => {
    const name = window.prompt(
      L('請為這個自訂主題命名：', 'カスタムテーマの名前を入力：'),
      L(`我的主題 ${savedCustoms.length + 1}`, `マイテーマ ${savedCustoms.length + 1}`)
    )
    if (!name || !name.trim()) return
    const newId = `custom_${Date.now()}`
    const nextList = [...savedCustoms, { id: newId, name: name.trim(), colors: { ...currentColors } }]
    setSavedCustoms(nextList)
    localStorage.setItem(STORAGE_SAVED_CUSTOMS, JSON.stringify(nextList))
    setActiveThemeId(newId)
    localStorage.setItem(STORAGE_THEME_ID, newId)
  }

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextList = savedCustoms.filter((c) => c.id !== id)
    setSavedCustoms(nextList)
    localStorage.setItem(STORAGE_SAVED_CUSTOMS, JSON.stringify(nextList))
    if (activeThemeId === id) {
      selectTheme(BUILTIN_THEMES[1])
    }
  }

  return (
    <>
      <div className="hint">
        {L('整份稿子的版面。設定存在作品上，所以每台裝置看到的樣子一致。',
           '原稿全体の組版。設定は作品に保存されるので、どの端末でも同じ見た目になる。')}
      </div>
      <div className="scroll">
        <div className="group-label">{L('介面語言', '表示言語')}</div>
        <div className="row" style={{ marginBottom: 14 }}>
          <button type="button" className={lang === 'zh' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setLang('zh')}>中文</button>
          <button type="button" className={lang === 'ja' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setLang('ja')}>日本語</button>
        </div>

        {/* 融入原本版面選項中的「網頁介面主題」 */}
        <div className="group-label">{L('網頁介面主題', 'ウェブ画面テーマ')}</div>
        <div className="theme-grid">
          {allThemes.map((t) => {
            const isSelected = activeThemeId === t.id
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-card ${isSelected ? 'selected' : ''}`}
                style={{
                  backgroundColor: t.colors.panel,
                  color: t.colors.ink,
                  borderColor: isSelected ? t.colors.seal : t.colors.line,
                }}
                onClick={() => selectTheme(t)}
              >
                <div className="theme-icon-preview" style={{ color: t.colors.ink }}>
                  <span className="theme-icon-dot" style={{ backgroundColor: t.colors.seal }} />
                  <span className="theme-icon-line" style={{ width: 16 }} />
                  <span className="theme-icon-line" style={{ width: 12 }} />
                  <span className="theme-icon-line" style={{ width: 14 }} />
                </div>
                <div className="theme-card-info">
                  <div className="theme-card-title">{t.name()}</div>
                  <div className="theme-card-sub">{t.sub()}</div>
                </div>
                {t.isCustom && (
                  <span
                    title={L('刪除此自訂主題', '削除')}
                    onClick={(e) => handleDeleteCustom(t.id, e)}
                    style={{ fontSize: 11, opacity: 0.65, padding: '2px 4px' }}
                  >
                    ✕
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button type="button" className="save-custom-btn" onClick={handleSaveAsMine}>
          ＋ {L('存成我的', 'マイテーマに保存')}
        </button>

        <div style={{ borderTop: '1px solid var(--line, rgba(128,128,128,0.25))', paddingTop: 6, marginBottom: 14 }}>
          <button type="button" className="tweak-toggle" onClick={() => setTweakOpen(!tweakOpen)}>
            <span>{tweakOpen ? '▾' : '▸'}</span>
            <span>{L(`微調「${currentThemeObj.name()}」`, `「${currentThemeObj.name()}」を微調整`)}</span>
          </button>

          {tweakOpen && (
            <div className="custom-color-grid">
              <label className="custom-color-item">
                <span>{L('寫作底色', '背景色')}</span>
                <input type="color" value={currentColors.bg} onChange={(e) => tweakColor('bg', e.target.value)} />
              </label>
              <label className="custom-color-item">
                <span>{L('側欄底色', 'パネル色')}</span>
                <input type="color" value={currentColors.panel} onChange={(e) => tweakColor('panel', e.target.value)} />
              </label>
              <label className="custom-color-item">
                <span>{L('按鈕底色', 'ボタン色')}</span>
                <input type="color" value={currentColors.panel2} onChange={(e) => tweakColor('panel2', e.target.value)} />
              </label>
              <label className="custom-color-item">
                <span>{L('文字顏色', '文字色')}</span>
                <input type="color" value={currentColors.ink} onChange={(e) => tweakColor('ink', e.target.value)} />
              </label>
              <label className="custom-color-item" style={{ gridColumn: '1 / -1' }}>
                <span>{L('重點強調色（印章色）', 'アクセント色')}</span>
                <input type="color" value={currentColors.seal} onChange={(e) => tweakColor('seal', e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <div className="group-label">{L('這部作品', 'この作品')}</div>
        <div className="field">
          <label className="lbl">{L('名稱', '題名')}</label>
          <TextInput value={project.title} onCommit={(v) => updRec(db.project, project.id, { title: v })} />
        </div>
        <div className="field">
          <label className="lbl">{L('一句話大綱', '一行のあらすじ')}</label>
          <TextInput value={project.logline} placeholder={L('誰、想要什麼、什麼擋著', '誰が、何を求め、何に阻まれるか')}
            onCommit={(v) => updRec(db.project, project.id, { logline: v })} />
        </div>
        {projects.length > 1 && (
          <>
            <div className="row" style={{ marginBottom: 6 }}>
              <button type="button" className="danger" style={{ flex: 1 }}
                onClick={() => { if (armed) { onDelete(project.id); setArmed(false) } else { setArmed(true); setTimeout(() => setArmed(false), 4000) } }}>
                {armed ? L('再按一次，整部刪掉', 'もう一度押すと、作品ごと消えます') : L('刪掉這部作品', 'この作品を削除')}
              </button>
            </div>
            <div className="sub" style={{ marginBottom: 12 }}>
              {L('章節、設定集、伏筆、素材、卡牌練習會一起消失，其他裝置同步後也會跟著消失。',
                 '章・設定資料・伏線・素材・カードの練習も一緒に消え、同期後は他の端末からも消えます。')}
            </div>
          </>
        )}

        <div className="group-label">{L('字體', '書体')}</div>
        <div className="row" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
          {FONTS.map((f) => (
            <button type="button" key={f.id} className={Lp.font === f.id ? 'on' : ''} onClick={() => set({ font: f.id })}>{f.label()}</button>
          ))}
        </div>
        <div className="sub" style={{ marginBottom: 12 }}>{FONTS.find((f) => f.id === Lp.font)!.note()}</div>

        <div className="group-label">{L('尺寸', '大きさ')}</div>
        <Slider label={L('字級', '文字サイズ')} value={Lp.size} min={13} max={26} step={1} unit=" px" onChange={(v) => set({ size: v })} />
        <Slider label={L('行距', '行間')} value={Lp.lineHeight} min={1.4} max={3} step={0.05} onChange={(v) => set({ lineHeight: v })} />
        <Slider label={L('字距', '字間')} value={Lp.letterSpacing} min={0} max={0.2} step={0.01} unit=" em" onChange={(v) => set({ letterSpacing: v })} />
        <Slider label={L('版心寬度', '一行の幅')} value={Lp.measure} min={26} max={64} step={1} unit=" rem" onChange={(v) => set({ measure: v })} />
        <div className="sub" style={{ marginBottom: 12 }}>
          {L('版心太寬，眼睛從行尾找回行首就會吃力。中文一行大約二十八到三十五個字最好讀。',
             '一行が長すぎると、行末から行頭に戻るのが辛くなる。日本語なら一行二十八〜三十五字あたりが読みやすい。')}
        </div>

        <div className="group-label">{L('段落縮排', '段落の字下げ')}</div>
        <div className="row" style={{ marginBottom: 6 }}>
          {([0, 1, 2] as const).map((n) => (
            <button type="button" key={n} className={Lp.indent === n ? 'on' : ''} style={{ flex: 1 }} onClick={() => set({ indent: n })}>
              {n === 0 ? L('不縮排', '下げない') : L(`${n} 格`, `${n} 字`)}
            </button>
          ))}
        </div>
        <div className="sub" style={{ marginBottom: 12 }}>
          {L('每段首行縮排，寫的時候就看得到。匯出 Word 會變成真正的首行縮排屬性，匯出 Markdown 則在段落開頭補上等量的全形空格。',
             '各段落の一行目を下げる。書いている最中から見える。Word へ書き出すと本物の字下げになり、Markdown では段落の先頭に全角空白が入る。')}
        </div>

        <div className="group-label">{L('預覽', 'プレビュー')}</div>
        <div className="card" style={{
          fontFamily: 'var(--ed-font)', fontSize: `${Math.min(Lp.size, 17)}px`,
          lineHeight: Lp.lineHeight, letterSpacing: `${Lp.letterSpacing}em`,
        }}>
          <span style={{ display: 'block', textIndent: `${Lp.indent}em` }}>
            {L('阿澤把菸按熄在紙杯裡，水面浮起一層灰。他沒有抬頭。',
               '男は煙草を紙コップに押しつけた。水面に灰が浮いた。顔は上げなかった。')}
          </span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="flat" style={{ flex: 1 }} onClick={() => set({ ...DEFAULT_LAYOUT })}>{L('回到預設', '既定に戻す')}</button>
        </div>
      </div>
    </>
  )
}