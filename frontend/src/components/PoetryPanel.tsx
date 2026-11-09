import { useState, useRef, useEffect } from 'react';


// 本地測試時註解掉線上網址，啟用本地
// const API_BASE_URL = 'http://127.0.0.1:8000';

// 部署前切換為 Render 線上後端網址：
//const API_BASE_URL = 'https://moonlight-backend-chdj.onrender.com';
const API_BASE_URL = 'https://moonlight-backend-chdj.onrender.com';

interface SearchResult {
  word: string;
  definition: string;
  style: string;
  emotion: string;
  scenario: string;
  texture?: string;
  nuance?: string;
}

// 詞彙選單選項
const STYLE_OPTIONS = ["全部風格", "典雅古樸", "文學修辭", "書面中性", "白話口語", "生動摹聲", "莊重客套", "方言鄉土", "俚俗粗白", "外來新詞", "專業術語"];
const EMOTION_OPTIONS = ["全部情緒", "歡快明朗", "驚詫意外", "溫柔深情", "哀傷淒清", "憂慮不安", "激憤強烈", "羞愧懊悔", "恬淡閒適", "自負張揚", "讚揚欣賞", "貶抑譏諷", "中性客觀"];
const SCENARIO_OPTIONS = ["全部情境", "人物外貌", "神態動作", "內心情緒", "對話言談", "性格評價", "愛情婚戀", "自然景物", "時令氛圍", "感官描寫", "生活起居", "衝突戰鬥"];

// 6 種風格（已移除組員人名）
const OUTLINE_GENRES = [
  { key: 'historical_tactics', label: '⚔️ 古風權謀（三幕劇）' },
  { key: 'fantasy_adventure', label: '🐉 奇幻冒險（英雄旅程）' },
  { key: 'urban_romance', label: '🏙️ 現代都會愛情（細膩轉折）' },
  { key: 'fantasy_mystery', label: '🔮 奇幻懸疑（記憶與代價）' },
  { key: 'psychological_thriller', label: '🧠 心理驚悚（懸念反轉）' },
  { key: 'school_romance', label: '🏫 青春校園愛情（酸甜心動）' },
];

// Story Bible 預設測資（已移除組員人名）
const BIBLE_TEST_CASES = [
  {
    name: '武俠舊傷矛盾（段雲飛）',
    bible: '主角「段雲飛」右腿有舊傷，不能長時間跑步或負重；隨身佩帶一把名為「青霜」的長劍。',
    draft: '段雲飛施展輕功在屋頂連續狂奔了半個時辰，輕鬆追上黑衣人，落地時還順手用青霜劍擋下了重擊。'
  },
  {
    name: '酒精過敏矛盾（林曉）',
    bible: '女主角「林曉」對酒精嚴重過敏（只要沾到就會全身起紅疹）；包包裡永遠放著一本「銀色筆記本」。',
    draft: '林曉在吧檯點了一杯威士忌一口氣乾完，隨即從包包裡掏出藍色筆記本，迅速記下了嫌疑人的車牌號碼。'
  },
  {
    name: '聽力障礙矛盾（鐘錶師伊萊）',
    bible: '失去聽力的鐘錶師「伊萊」能透過修復古老機械來讀取與其相關的人的記憶。',
    draft: '伊萊聽見門鈴響起，他知道是上週委託的客人來了，便放下手上的工作起身迎接客人。'
  },
  {
    name: '無痛覺改造人矛盾（零）',
    bible: '「零」是實驗室做改造人實驗的實驗品，在實驗中出了差錯導致零沒有痛覺且不會產生任何感情。',
    draft: '朋友為了惡整零故意在他的水壺裡加辣椒水，不知情的零喝了一大口馬上吐了出來。'
  }
];

export function PoetryPanel() {
  const [style, setStyle] = useState('全部風格');
  const [emotion, setEmotion] = useState('全部情緒');
  const [scenario, setScenario] = useState('全部情境');
  
  // 模式 1：詞彙檢索
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // 模式 2：AI 擴寫
  const [baseText, setBaseText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 模式 3：AI 盲點診斷
  const [draftText, setDraftText] = useState('');
  const [coachResult, setCoachResult] = useState('');
  const [isCoaching, setIsCoaching] = useState(false);

  // 模式 4：AI 設定追蹤 (Story Bible)
  const [bibleText, setBibleText] = useState('');
  const [chapterDraft, setChapterDraft] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // 模式 5：新手大綱精靈
  const [genre, setGenre] = useState('historical_tactics');
  const [outlineGoal, setOutlineGoal] = useState('');
  const [outlineAntagonist, setOutlineAntagonist] = useState('');
  const [outlineWorldview, setOutlineWorldview] = useState('');
  const [outlineResult, setOutlineResult] = useState('');
  const [isOutlining, setIsOutlining] = useState(false);

  // UI
  const [activeTab, setActiveTab] = useState<'search' | 'ai' | 'coach' | 'bible' | 'outline'>('bible'); 
  const [isOpen, setIsOpen] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const draggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem('moonlight_favorites');
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    } catch (e) {
      localStorage.removeItem('moonlight_favorites');
    }
    const savedBible = localStorage.getItem('moonlight_bible');
    if (savedBible) setBibleText(savedBible);
  }, []);

  const handleBibleChange = (text: string) => {
    setBibleText(text);
    localStorage.setItem('moonlight_bible', text);
  };

  // 搜尋詞庫
  const handleSearch = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/search_advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword, 
          style: style === '全部風格' ? '' : style, 
          emotion: emotion === '全部情緒' ? '' : emotion, 
          scenario: scenario === '全部情境' ? '' : scenario 
        })
      });
      const data = await response.json();
      if (data.status === 'success') setResults(data.data);
      else setResults([]);
    } catch (error) {
      alert('連線失敗，請確認後端是否開啟');
    }
  };

  // AI 擴寫
  const handleAIExpand = async () => {
    if (!baseText.trim()) return alert("請先輸入一句基礎句子！");
    setIsGenerating(true);
    setAiResult('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/expand_inspiration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          base_text: baseText, 
          style: style === '全部風格' ? '' : style, 
          emotion: emotion === '全部情緒' ? '' : emotion, 
          scenario: scenario === '全部情境' ? '' : scenario 
        })
      });
      const data = await response.json();
      setAiResult(data.status === 'success' ? data.data : '❌ 生成失敗：' + data.message);
    } catch (error) {
      setAiResult('❌ 連線失敗');
    } finally {
      setIsGenerating(false);
    }
  };

  // 盲點診斷
  const handleCoaching = async () => {
    if (!draftText.trim()) return alert("請先貼上草稿！");
    setIsCoaching(true);
    setCoachResult('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/writing_coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_text: draftText })
      });
      const data = await response.json();
      setCoachResult(data.status === 'success' ? data.data : '❌ 診斷失敗：' + data.message);
    } catch (error) {
      setCoachResult('❌ 連線失敗');
    } finally {
      setIsCoaching(false);
    }
  };

  // 設定追蹤掃描
  const handleLogicScan = async () => {
    if (!bibleText.trim() || !chapterDraft.trim()) return alert("設定集與本章草稿都需要填寫！");
    setIsScanning(true);
    setScanResult('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/story_bible_scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bible_text: bibleText, draft_text: chapterDraft })
      });
      const data = await response.json();
      setScanResult(data.status === 'success' ? data.data : '❌ 掃描失敗：' + data.message);
    } catch (error) {
      setScanResult('❌ 連線失敗，請檢查後端日誌。');
    } finally {
      setIsScanning(false);
    }
  };

  // 大綱精靈生成
  const handleOutlineGenerate = async () => {
    if (!outlineGoal.trim() || !outlineAntagonist.trim() || !outlineWorldview.trim()) {
      return alert("請填寫目標、困境與世界觀！");
    }
    setIsOutlining(true);
    setOutlineResult('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/outline_wizard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          genre, 
          goal: outlineGoal, 
          antagonist: outlineAntagonist, 
          worldview: outlineWorldview 
        })
      });
      const data = await response.json();
      setOutlineResult(data.status === 'success' ? data.data : '❌ 大綱生成失敗：' + data.message);
    } catch (error) {
      setOutlineResult('❌ 連線失敗，請檢查後端日誌。');
    } finally {
      setIsOutlining(false);
    }
  };

  const toggleFavorite = (word: string) => {
    const newFavs = favorites.includes(word) ? favorites.filter(f => f !== word) : [...favorites, word];
    setFavorites(newFavs);
    localStorage.setItem('moonlight_favorites', JSON.stringify(newFavs));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    startPosRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) setPosition({ x: e.clientX - startPosRef.current.x, y: e.clientY - startPosRef.current.y });
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={{ position: 'fixed', bottom: '30px', right: '30px', padding: '12px 24px', backgroundColor: '#75a862', color: 'white', border: 'none', borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 9999, fontWeight: 'bold' }}>
        🌙 喚醒靈感
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', left: position.x, top: position.y, display: 'flex', gap: '10px', zIndex: 9999 }}>
      {/* 主要面板：加上 overflowY: 'auto' 確保整塊面板超出螢幕時可以完整向下滾動 */}
      <div style={{ backgroundColor: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '16px', boxShadow: '0 12px 30px rgba(0,0,0,0.2)', padding: '18px', width: '420px', maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        
        {/* 面板標題列 */}
        <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb', touchAction: 'none' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#1f2937', userSelect: 'none' }}>🌙 月下語詩寫作助手</h3>
          <div>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowBackpack(!showBackpack)} title="開啟靈感背包" style={{ border: 'none', background: 'none', cursor: 'pointer', marginRight: '6px', fontSize: '18px' }}>🎒</button>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setIsOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}>✕</button>
          </div>
        </div>

        {/* 頁籤列 */}
        <div style={{ display: 'flex', marginBottom: '14px', borderBottom: '2px solid #e5e7eb', fontSize: '13px' }}>
          <button onClick={() => setActiveTab('search')} style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'search' ? '2px solid #75a862' : 'none', color: activeTab === 'search' ? '#75a862' : '#6b7280', fontWeight: activeTab === 'search' ? 'bold' : 'normal', cursor: 'pointer' }}>詞彙檢索</button>
          <button onClick={() => setActiveTab('ai')} style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'ai' ? '2px solid #8e44ad' : 'none', color: activeTab === 'ai' ? '#8e44ad' : '#6b7280', fontWeight: activeTab === 'ai' ? 'bold' : 'normal', cursor: 'pointer' }}>AI 擴寫</button>
          <button onClick={() => setActiveTab('coach')} style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'coach' ? '2px solid #e67e22' : 'none', color: activeTab === 'coach' ? '#e67e22' : '#6b7280', fontWeight: activeTab === 'coach' ? 'bold' : 'normal', cursor: 'pointer' }}>盲點診斷</button>
          <button onClick={() => setActiveTab('bible')} style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'bible' ? '2px solid #e74c3c' : 'none', color: activeTab === 'bible' ? '#e74c3c' : '#6b7280', fontWeight: activeTab === 'bible' ? 'bold' : 'normal', cursor: 'pointer' }}>設定追蹤</button>
          <button onClick={() => setActiveTab('outline')} style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'outline' ? '2px solid #2563eb' : 'none', color: activeTab === 'outline' ? '#2563eb' : '#6b7280', fontWeight: activeTab === 'outline' ? 'bold' : 'normal', cursor: 'pointer' }}>大綱精靈</button>
        </div>

        {/* 詞彙標籤過濾選單 (詞彙檢索與 AI 擴寫共用) */}
        {(activeTab === 'search' || activeTab === 'ai') && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <select value={style} onChange={(e) => setStyle(e.target.value)} style={{ width: '33%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              {STYLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select value={emotion} onChange={(e) => setEmotion(e.target.value)} style={{ width: '33%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              {EMOTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} style={{ width: '33%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              {SCENARIO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        )}

        {/* 模式 1：詞彙檢索 */}
        {activeTab === 'search' && (
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="搜尋關鍵字 (例：秋天、寂寞)" style={{ flex: 1, padding: '7px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <button onClick={handleSearch} style={{ padding: '7px 14px', backgroundColor: '#75a862', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>搜尋</button>
            </div>
            <div style={{ maxHeight: '320px', overflowY: 'auto', fontSize: '13px', backgroundColor: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              {results.length === 0 ? <p style={{ color: '#9ca3af', margin: '10px 0' }}>無資料，請輸入關鍵字或篩選標籤後點擊搜尋。</p> : results.map((res, idx) => (
                <div key={idx} style={{ padding: '8px 4px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>{res.word}</span>
                    <button onClick={() => toggleFavorite(res.word)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>
                      {favorites.includes(res.word) ? '❤️' : '🤍'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', margin: '4px 0', flexWrap: 'wrap' }}>
                    {res.style && <span style={{ fontSize: '10px', padding: '1px 5px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>{res.style}</span>}
                    {res.emotion && <span style={{ fontSize: '10px', padding: '1px 5px', backgroundColor: '#ffe4e6', color: '#9f1239', borderRadius: '4px' }}>{res.emotion}</span>}
                    {res.texture && <span style={{ fontSize: '10px', padding: '1px 5px', backgroundColor: '#e0f2fe', color: '#075985', borderRadius: '4px' }}>{res.texture}</span>}
                  </div>
                  <p style={{ margin: '3px 0 0 0', color: '#4b5563', fontSize: '12px', lineHeight: '1.4' }}>{res.definition}</p>
                  {res.nuance && <p style={{ margin: '2px 0 0 0', color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>💡 {res.nuance}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 模式 2：AI 擴寫 */}
        {activeTab === 'ai' && (
          <div>
            <textarea value={baseText} onChange={(e) => setBaseText(e.target.value)} placeholder="輸入一句枯燥的基礎句子（例如：他走進雨中。）" style={{ width: '100%', height: '60px', marginBottom: '8px', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box', resize: 'none' }} />
            <button onClick={handleAIExpand} disabled={isGenerating} style={{ width: '100%', padding: '9px', backgroundColor: isGenerating ? '#9ca3af' : '#8e44ad', color: 'white', border: 'none', borderRadius: '6px', cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {isGenerating ? '✨ AI 運算中...' : '✨ 沉浸式擴寫'}
            </button>
            <div style={{ marginTop: '12px', minHeight: '120px', maxHeight: '280px', overflowY: 'auto', fontSize: '13px', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {aiResult ? aiResult : <p style={{ color: '#9ca3af', margin: 0 }}>輸入句子並設定上方標籤，AI 會幫你生成三種不同角度的優美描寫。</p>}
            </div>
          </div>
        )}

        {/* 模式 3：AI 盲點診斷 */}
        {activeTab === 'coach' && (
          <div>
            <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="貼上約 100~500 字的草稿，讓 AI 編輯給你專業建議..." style={{ width: '100%', height: '80px', marginBottom: '8px', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box', resize: 'vertical' }} />
            <button onClick={handleCoaching} disabled={isCoaching} style={{ width: '100%', padding: '9px', backgroundColor: isCoaching ? '#9ca3af' : '#e67e22', color: 'white', border: 'none', borderRadius: '6px', cursor: isCoaching ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {isCoaching ? '🩺 編輯審稿中...' : '🩺 請 AI 教練給建議'}
            </button>
            <div style={{ marginTop: '12px', minHeight: '120px', maxHeight: '280px', overflowY: 'auto', fontSize: '13px', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {coachResult ? coachResult : <p style={{ color: '#9ca3af', margin: 0 }}>將卡關的段落貼上來，幫你突破盲點。</p>}
            </div>
          </div>
        )}

        {/* 模式 4：AI 設定追蹤 (Story Bible) */}
        {activeTab === 'bible' && (
          <div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: 'bold' }}>快速載入測試案例：</span>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                {BIBLE_TEST_CASES.map((tc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleBibleChange(tc.bible);
                      setChapterDraft(tc.draft);
                    }}
                    style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#e5e7eb', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', color: '#374151' }}
                  >
                    {tc.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#374151', fontWeight: 'bold' }}>📚 專案設定集</label>
              <textarea value={bibleText} onChange={(e) => handleBibleChange(e.target.value)} placeholder="例如：男主角右腿有舊傷不能跑步..." style={{ width: '100%', height: '55px', marginTop: '4px', padding: '6px 8px', boxSizing: 'border-box', resize: 'vertical', backgroundColor: '#fffdf5', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '12px' }} />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#374151', fontWeight: 'bold' }}>✍️ 本章草稿</label>
              <textarea value={chapterDraft} onChange={(e) => setChapterDraft(e.target.value)} placeholder="貼上寫好的章節內容..." style={{ width: '100%', height: '55px', marginTop: '4px', padding: '6px 8px', boxSizing: 'border-box', resize: 'vertical', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }} />
            </div>
            <button onClick={handleLogicScan} disabled={isScanning} style={{ width: '100%', padding: '9px', backgroundColor: isScanning ? '#9ca3af' : '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: isScanning ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
              {isScanning ? '🔍 邏輯掃描中...' : '🔍 AI 邏輯掃描'}
            </button>
            {/* 回覆展示區：有明確高度與 scroll 支援 */}
            <div style={{ marginTop: '12px', minHeight: '120px', maxHeight: '260px', overflowY: 'auto', fontSize: '13px', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {scanResult ? scanResult : <p style={{ color: '#9ca3af', margin: 0 }}>點擊上方按鈕帶入測試案例，再點擊掃描觀察 AI 揪錯能力。</p>}
            </div>
          </div>
        )}

        {/* 模式 5：新手大綱精靈 */}
        {activeTab === 'outline' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#374151', fontWeight: 'bold', whiteSpace: 'nowrap' }}>風格類型：</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                {OUTLINE_GENRES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <input type="text" value={outlineGoal} onChange={(e) => setOutlineGoal(e.target.value)} placeholder="1. 主角最渴望的目標 (例：找回失去的重要之人)" style={{ width: '100%', marginBottom: '6px', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <input type="text" value={outlineAntagonist} onChange={(e) => setOutlineAntagonist(e.target.value)} placeholder="2. 最大反派或心理困境 (例：尋找過程中逐漸失去記憶)" style={{ width: '100%', marginBottom: '6px', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <input type="text" value={outlineWorldview} onChange={(e) => setOutlineWorldview(e.target.value)} placeholder="3. 世界觀或時代背景 (例：記憶可換取財富的世界)" style={{ width: '100%', marginBottom: '6px', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <button onClick={handleOutlineGenerate} disabled={isOutlining} style={{ width: '100%', padding: '9px', backgroundColor: isOutlining ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: isOutlining ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {isOutlining ? '📜 構思大綱中...' : '📜 生成三幕劇大綱'}
            </button>
            <div style={{ marginTop: '12px', minHeight: '120px', maxHeight: '260px', overflowY: 'auto', fontSize: '13px', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {outlineResult ? outlineResult : <p style={{ color: '#9ca3af', margin: 0 }}>選擇風格並填寫 3 個問題，AI 總編為你生成大綱建議。</p>}
            </div>
          </div>
        )}

      </div>

      {/* 背包側邊欄 */}
      {showBackpack && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '16px', boxShadow: '0 12px 30px rgba(0,0,0,0.15)', padding: '15px', width: '200px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', fontSize: '14px', color: '#1f2937' }}>🎒 我的靈感庫</h4>
          {favorites.length === 0 ? <p style={{ fontSize: '12px', color: '#9ca3af' }}>背包空空的...</p> : (
            <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', overflowY: 'auto', flex: 1 }}>
              {favorites.map((fav, idx) => (
                <li key={idx} style={{ marginBottom: '8px', color: '#374151' }}>{fav}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}