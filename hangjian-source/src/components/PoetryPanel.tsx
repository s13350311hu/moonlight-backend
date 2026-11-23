import { useState } from "react";

const API_BASE_URL = "https://moonlight-backend-chdj.onrender.com";

export type AiSubTab = "lexicon" | "expand" | "coach" | "consistency" | "outline";

interface PoetryPanelProps {
  activeSubTab: AiSubTab;
  onInsert?: (text: string) => void;
  getSelectedText?: () => string;
  getCurrentChapterText?: () => string;
}

interface WordItem {
  word: string;
  definition: string;
  style?: string;
  emotion?: string;
  nuance?: string;
}

const CONSISTENCY_PRESETS = [
  {
    label: "武俠舊傷矛盾（段雲飛）",
    setting: "主角「段雲飛」三年前在斷魂崖被寒冰掌震碎右肩經脈，從此右手無法提重物，更無法使出需要剛猛內力的「烈陽劍法」。",
    draft: "危急關頭，段雲飛右手緊握重劍，運起全身剛猛內力，一招烈陽劍法橫掃而出，將三名黑衣人震退數步。",
  },
  {
    label: "酒精過敏矛盾（林曉）",
    setting: "女主角「林曉」患有嚴重先天性酒精過敏，只要沾到一滴酒就會立刻起紅疹、呼吸困難甚至休克。",
    draft: "慶功宴上氣氛熱烈，林曉端起桌上的烈酒一飲而盡，豪邁地笑著說要與眾人不醉不歸。",
  },
  {
    label: "聽力障礙矛盾（鐘錶師伊萊）",
    setting: "失去聽力的鐘錶師「伊萊」能透過修復古老機械來讀取與其相關的人的記憶。",
    draft: "雨夜裡，伊萊背對著大門專注修錶，突然聽見身後傳來一陣極輕微的腳步聲，他立刻警覺地回頭。",
  },
  {
    label: "無痛覺改造人矛盾（零）",
    setting: "編號「零」的改造人在實驗中切斷了所有痛覺神經，無論受到多嚴重的物理創傷都感覺不到疼痛。",
    draft: "匕首劃破了零的手臂，鮮血直流，他疼得倒吸一口涼氣，緊皺眉頭捂住傷口蜷縮在牆角。",
  },
];

export function PoetryPanel({
  activeSubTab,
  onInsert,
  getSelectedText,
  getCurrentChapterText,
}: PoetryPanelProps) {
  const [copiedId, setCopiedId] = useState("");

  // 1. 詞彙檢索狀態
  const [kw, setKw] = useState("");
  const [styleFilter, setStyleFilter] = useState("全部風格");
  const [emotionFilter, setEmotionFilter] = useState("全部情緒");
  const [scenarioFilter, setScenarioFilter] = useState("全部情境");
  const [words, setWords] = useState<WordItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");

  // 2. AI 擴寫狀態
  const [expandInput, setExpandInput] = useState("");
  const [expandResult, setExpandResult] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);

  // 3. 盲點診斷狀態
  const [coachInput, setCoachInput] = useState("");
  const [coachResult, setCoachResult] = useState("");
  const [isCoaching, setIsCoaching] = useState(false);

  // 4. 設定追蹤狀態 (對應 /api/story_bible_scan)
  const [bibleSetting, setBibleSetting] = useState("");
  const [bibleDraft, setBibleDraft] = useState("");
  const [consistencyResult, setConsistencyResult] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  // 5. 大綱精靈狀態 (對應 /api/outline_wizard)
  const [genre, setGenre] = useState("historical_tactics");
  const [goal, setGoal] = useState("");
  const [antagonist, setAntagonist] = useState("");
  const [worldview, setWorldview] = useState("");
  const [outlineResult, setOutlineResult] = useState("");
  const [isOutlining, setIsOutlining] = useState(false);

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1400);
  };

  const safeFetch = async (endpoint: string, payload: object) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await res.json();
      return { ok: res.ok, data };
    } finally {
      clearTimeout(timer);
    }
  };

  // API 1: /api/search_advanced
  const handleSearch = async () => {
    setIsSearching(true);
    setSearchMsg("");
    try {
      const { ok, data } = await safeFetch("/api/search_advanced", {
        keyword: kw.trim(),
        style: styleFilter === "全部風格" ? "" : styleFilter,
        emotion: emotionFilter === "全部情緒" ? "" : emotionFilter,
        scenario: scenarioFilter === "全部情境" ? "" : scenarioFilter,
      });
      if (ok && data.status === "success") {
        const list = data.data || [];
        setWords(list);
        if (list.length === 0) setSearchMsg("找不到相符的詞彙，請調整關鍵字或篩選標籤。");
      } else {
        setSearchMsg(data.message || data.detail || "檢索發生錯誤");
      }
    } catch {
      setSearchMsg("伺服器連線逾時（Render 喚醒約需 20 秒，請再按一次搜尋）。");
    } finally {
      setIsSearching(false);
    }
  };

  // API 2: /api/expand_inspiration
  const handleExpand = async () => {
    if (!expandInput.trim()) return;
    setIsExpanding(true);
    try {
      const { ok, data } = await safeFetch("/api/expand_inspiration", {
        base_text: expandInput.trim(),
        style: "",
        emotion: "",
        scenario: "",
      });
      if (ok && data.status === "success") {
        setExpandResult(data.data);
      } else {
        setExpandResult(`擴寫失敗：${data.message || data.detail || "未知錯誤"}`);
      }
    } catch {
      setExpandResult("連線逾時或伺服器喚醒中，請稍候再試。");
    } finally {
      setIsExpanding(false);
    }
  };

  // API 3: /api/writing_coach
  const handleCoach = async () => {
    if (!coachInput.trim()) return;
    setIsCoaching(true);
    try {
      const { ok, data } = await safeFetch("/api/writing_coach", {
        draft_text: coachInput.trim(),
      });
      if (ok && data.status === "success") {
        setCoachResult(data.data);
      } else {
        setCoachResult(`診斷失敗：${data.message || data.detail || "未知錯誤"}`);
      }
    } catch {
      setCoachResult("連線逾時或伺服器喚醒中，請稍候再試。");
    } finally {
      setIsCoaching(false);
    }
  };

  // API 4: /api/story_bible_scan (完全對齊 bible_text 與 draft_text)
  const handleCheckConsistency = async () => {
    if (!bibleSetting.trim() || !bibleDraft.trim()) return;
    setIsChecking(true);
    try {
      const { ok, data } = await safeFetch("/api/story_bible_scan", {
        bible_text: bibleSetting.trim(),
        draft_text: bibleDraft.trim(),
      });
      if (ok && data.status === "success") {
        setConsistencyResult(data.data);
      } else {
        setConsistencyResult(`掃描失敗：${data.message || data.detail || "未知錯誤"}`);
      }
    } catch {
      setConsistencyResult("連線逾時或伺服器喚醒中，請稍候再試。");
    } finally {
      setIsChecking(false);
    }
  };

  // API 5: /api/outline_wizard (完全對齊 genre, goal, antagonist, worldview)
  const handleOutline = async () => {
    setIsOutlining(true);
    try {
      const { ok, data } = await safeFetch("/api/outline_wizard", {
        genre,
        goal: goal.trim() || "未指定目標",
        antagonist: antagonist.trim() || "未指定阻礙",
        worldview: worldview.trim() || "一般背景",
      });
      if (ok && data.status === "success") {
        setOutlineResult(data.data);
      } else {
        setOutlineResult(`生成失敗：${data.message || data.detail || "未知錯誤"}`);
      }
    } catch {
      setOutlineResult("連線逾時或伺服器喚醒中，請稍候再試。");
    } finally {
      setIsOutlining(false);
    }
  };

  return (
    <div className="scroll">
      {/* 1. 詞彙庫 */}
      {activeSubTab === "lexicon" && (
        <div className="stack">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <select value={styleFilter} onChange={(e) => setStyleFilter(e.target.value)}>
              <option value="全部風格">全部風格</option>
              <option value="古">典雅古樸 / 古風</option>
              <option value="文藝">細膩文藝</option>
              <option value="白話">通俗白話</option>
              <option value="華麗">華麗辭藻</option>
              <option value="武俠">武俠江湖</option>
            </select>
            <select value={emotionFilter} onChange={(e) => setEmotionFilter(e.target.value)}>
              <option value="全部情緒">全部情緒</option>
              <option value="悲">悲傷哀愁</option>
              <option value="喜">歡快明朗</option>
              <option value="怒">憤怒激昂</option>
              <option value="驚">驚詫意外</option>
              <option value="靜">平靜淡然</option>
              <option value="懼">恐懼緊張</option>
            </select>
            <select value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)}>
              <option value="全部情境">全部情境</option>
              <option value="神態">神態動作</option>
              <option value="景">景物描寫</option>
              <option value="心理">心理活動</option>
              <option value="外貌">外貌衣著</option>
              <option value="環境">環境氛圍</option>
            </select>
          </div>

          <div className="row">
            <input
              placeholder="搜尋關鍵字（例：秋天、寂寞）"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="btn-sage" onClick={handleSearch} disabled={isSearching} style={{ flexShrink: 0 }}>
              {isSearching ? "搜尋中" : "搜尋"}
            </button>
          </div>

          {words.length === 0 && !searchMsg && (
            <div className="empty">無資料，請輸入關鍵字或篩選標籤後點擊搜尋。</div>
          )}
          {searchMsg && <div className="empty">{searchMsg}</div>}

          {words.map((item, idx) => (
            <div className="card" key={`${item.word}-${idx}`}>
              <div className="card-top">
                <strong style={{ fontFamily: "var(--serif)", fontSize: "14px" }}>{item.word}</strong>
                {item.style && <span className="tag seal">{item.style}</span>}
                {item.emotion && <span className="tag ok">{item.emotion}</span>}
                <span className="grow" />
                <button className="flat" onClick={() => copyText(item.word, item.word)}>
                  {copiedId === item.word ? "✓" : "複製"}
                </button>
                {onInsert && (
                  <button
                    className="flat"
                    style={{ color: "var(--sage)", fontWeight: 600 }}
                    onClick={() => onInsert(item.word)}
                  >
                    ＋插入
                  </button>
                )}
              </div>
              <div className="sub">{item.definition}</div>
            </div>
          ))}
        </div>
      )}

      {/* 2. AI 擴寫 */}
      {activeSubTab === "expand" && (
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="lbl" style={{ margin: 0 }}>基礎句子輸入</span>
            {getSelectedText && (
              <button
                className="flat"
                style={{ fontSize: "11px", color: "var(--plum)" }}
                onClick={() => {
                  const sel = getSelectedText().trim();
                  if (sel) setExpandInput(sel);
                }}
              >
                帶入選取文字
              </button>
            )}
          </div>
          <textarea
            rows={3}
            placeholder="輸入想擴寫的句子（例如：他執傘走進江南煙雨中...）"
            value={expandInput}
            onChange={(e) => setExpandInput(e.target.value)}
          />
          <button className="btn-plum" onClick={handleExpand} disabled={isExpanding || !expandInput.trim()}>
            {isExpanding ? "✨ 正在醞釀文字靈感..." : "✨ 沉浸式擴寫"}
          </button>

          {expandResult && (
            <div className="card" style={{ marginTop: "6px" }}>
              <div className="card-top">
                <span className="tag" style={{ color: "var(--plum)", borderColor: "var(--plum)" }}>AI 擴寫建議</span>
                <span className="grow" />
                <button className="flat" onClick={() => copyText(expandResult, "expand")}>
                  {copiedId === "expand" ? "已複製" : "複製全文"}
                </button>
                {onInsert && (
                  <button
                    className="flat"
                    style={{ color: "var(--plum)", fontWeight: 600 }}
                    onClick={() => onInsert(expandResult)}
                  >
                    ＋插入正文
                  </button>
                )}
              </div>
              <div className="ai-result-text">{expandResult}</div>
            </div>
          )}
        </div>
      )}

      {/* 3. 盲點診斷 */}
      {activeSubTab === "coach" && (
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="lbl" style={{ margin: 0 }}>貼上草稿段落（建議 100~500 字）</span>
            {getCurrentChapterText && (
              <button
                className="flat"
                style={{ fontSize: "11px", color: "var(--warn)" }}
                onClick={() => {
                  const txt = getCurrentChapterText().trim();
                  if (txt) setCoachInput(txt.slice(0, 800));
                }}
              >
                帶入本章草稿
              </button>
            )}
          </div>
          <textarea
            rows={5}
            placeholder="貼上想診斷節奏、感官描寫或「Show, Don't Tell」的草稿段落..."
            value={coachInput}
            onChange={(e) => setCoachInput(e.target.value)}
          />
          <button className="btn-amber" onClick={handleCoach} disabled={isCoaching || !coachInput.trim()}>
            {isCoaching ? "🩺 AI 教練審稿中..." : "🩺 請 AI 教練給建議"}
          </button>

          {coachResult && (
            <div className="card" style={{ marginTop: "6px" }}>
              <div className="card-top">
                <span className="tag" style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>診斷報告</span>
                <span className="grow" />
                <button className="flat" onClick={() => copyText(coachResult, "coach")}>
                  {copiedId === "coach" ? "已複製" : "複製"}
                </button>
              </div>
              <div className="ai-result-text">{coachResult}</div>
            </div>
          )}
        </div>
      )}

      {/* 4. 設定追蹤 */}
      {activeSubTab === "consistency" && (
        <div className="stack">
          <div>
            <span className="lbl" style={{ marginBottom: "6px", fontWeight: 600 }}>快速載入測試案例：</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {CONSISTENCY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className="preset-chip"
                  onClick={() => {
                    setBibleSetting(preset.setting);
                    setBibleDraft(preset.draft);
                    setConsistencyResult("");
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="lbl" style={{ fontWeight: 600 }}>📚 專案設定集</span>
            <textarea
              rows={3}
              placeholder="輸入角色傷病、禁忌、世界觀規則..."
              value={bibleSetting}
              onChange={(e) => setBibleSetting(e.target.value)}
            />
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: "4px" }}>
              <span className="lbl" style={{ margin: 0, fontWeight: 600 }}>✍️ 本章草稿</span>
              {getCurrentChapterText && (
                <button
                  className="flat"
                  style={{ fontSize: "11px", color: "var(--seal)" }}
                  onClick={() => {
                    const txt = getCurrentChapterText().trim();
                    if (txt) setBibleDraft(txt.slice(0, 1200));
                  }}
                >
                  帶入目前編輯器正文
                </button>
              )}
            </div>
            <textarea
              rows={4}
              placeholder="貼上寫好的章節內容..."
              value={bibleDraft}
              onChange={(e) => setBibleDraft(e.target.value)}
            />
          </div>

          <button
            className="btn-seal"
            onClick={handleCheckConsistency}
            disabled={isChecking || !bibleSetting.trim() || !bibleDraft.trim()}
          >
            {isChecking ? "🔍 正在掃描設定矛盾..." : "🔍 AI 邏輯掃描"}
          </button>

          {consistencyResult && (
            <div className="card lit" style={{ marginTop: "6px" }}>
              <div className="card-top">
                <span className="tag seal">邏輯掃描結果</span>
                <span className="grow" />
                <button className="flat" onClick={() => copyText(consistencyResult, "consistency")}>
                  {copiedId === "consistency" ? "已複製" : "複製"}
                </button>
              </div>
              <div className="ai-result-text">{consistencyResult}</div>
            </div>
          )}
        </div>
      )}

      {/* 5. 大綱精靈 (對應後端 OUTLINE_PROMPTS 的 6 個鍵值) */}
      {activeSubTab === "outline" && (
        <div className="stack">
          <div className="field" style={{ marginBottom: 4 }}>
            <label className="lbl">故事類型與結構</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="historical_tactics">⚔️ 古風權謀（三幕劇）</option>
              <option value="fantasy_adventure">☁️ 仙俠奇幻冒險（英雄旅程）</option>
              <option value="urban_romance">🏙️ 現代都市情感（起承轉合）</option>
              <option value="fantasy_mystery">🔍 奇幻懸疑推理（五幕結構）</option>
              <option value="psychological_thriller">🧠 心理驚悚懸疑</option>
              <option value="school_romance">🌸 校園青春戀愛</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 4 }}>
            <label className="lbl">主角核心目標</label>
            <input placeholder="例如：查明十年前滅門真相" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 4 }}>
            <label className="lbl">最大阻力 / 反派</label>
            <input placeholder="例如：掌握朝堂大權的師兄" value={antagonist} onChange={(e) => setAntagonist(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 6 }}>
            <label className="lbl">核心世界觀 / 關鍵物件</label>
            <input placeholder="例如：以琴音催動內力的江湖" value={worldview} onChange={(e) => setWorldview(e.target.value)} />
          </div>
          <button className="btn-seal" onClick={handleOutline} disabled={isOutlining}>
            {isOutlining ? "📜 正在推演情節脈絡..." : "📜 生成故事大綱"}
          </button>

          {outlineResult && (
            <div className="card" style={{ marginTop: "6px" }}>
              <div className="card-top">
                <span className="tag seal">故事大綱</span>
                <span className="grow" />
                <button className="flat" onClick={() => copyText(outlineResult, "outline")}>
                  {copiedId === "outline" ? "已複製" : "複製"}
                </button>
                {onInsert && (
                  <button
                    className="flat"
                    style={{ color: "var(--seal)", fontWeight: 600 }}
                    onClick={() => onInsert(outlineResult)}
                  >
                    ＋插入正文
                  </button>
                )}
              </div>
              <div className="ai-result-text">{outlineResult}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}