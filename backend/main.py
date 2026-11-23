from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import sqlite3
import itertools
import time
from dotenv import load_dotenv
import google.generativeai as genai
from prompts import OUTLINE_PROMPTS, STORY_BIBLE_SCAN_PROMPT

# ==========================================
# 1. 多組 API Key 輪替池 + 多模型容錯引擎
# ==========================================
load_dotenv()

# 讀取以逗號分隔的多組 API Key（例如：KEY1,KEY2,KEY3,KEY4）
RAW_KEYS = os.getenv("GEMINI_API_KEY", "")
API_KEYS = [k.strip() for k in RAW_KEYS.split(",") if k.strip()]

# 建立循環輪替器
key_cycle = itertools.cycle(API_KEYS) if API_KEYS else None

# 模型優先順序：首選你指定的 gemini-3.8-flash，遇單一 Key 限流時自動備援
MODEL_CANDIDATES = [
    "gemini-3.8-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
]

if API_KEYS:
    print(f"✅ 已載入 {len(API_KEYS)} 組 Gemini API Key 進入輪替池")
else:
    print("⚠️ 警告：找不到 GEMINI_API_KEY，AI 功能將無法運作")


def generate_resilient(prompt: str) -> str:
    if not API_KEYS or not key_cycle:
        raise RuntimeError("伺服器尚未設定 GEMINI_API_KEY，請至 Render Environment 確認。")

    for model_name in MODEL_CANDIDATES:
        for _ in range(len(API_KEYS)):
            current_key = next(key_cycle)
            try:
                genai.configure(api_key=current_key)
                m = genai.GenerativeModel(model_name)
                response = m.generate_content(prompt)
                if response and response.text:
                    return response.text
            except Exception as e:
                err_msg = str(e)
                if any(code in err_msg for code in ["429", "Quota", "ResourceExhausted", "not found", "503"]):
                    print(f"⚠️ [Key ...{current_key[-4:]}] 呼叫 {model_name} 受限，0.2 秒後切換下一組...")
                    time.sleep(0.2)
                    continue
                raise e

    raise RuntimeError("所有免費 API 金鑰目前皆達每分鐘上限，請稍候 20 秒後再試一次。")


app = FastAPI(title="Moonlight Poetry API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "word_bank.db")


# ==========================================
# 2. SQLite 查詢共用輔助函式
# ==========================================
def query_word_bank(keyword: str = "", style: str = "", emotion: str = "", scenario: str = "", limit: int = 30) -> List[Dict[str, Any]]:
    if not os.path.exists(DB_PATH):
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    conditions = []
    params = []

    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        conditions.append("(word LIKE ? OR definition LIKE ?)")
        params.extend([kw, kw])

    if style and style.strip() and style != "全部風格":
        conditions.append("style LIKE ?")
        params.append(f"%{style.strip()}%")

    if emotion and emotion.strip() and emotion != "全部情緒":
        conditions.append("emotion LIKE ?")
        params.append(f"%{emotion.strip()}%")

    if scenario and scenario.strip() and scenario != "全部情境":
        conditions.append("scenario LIKE ?")
        params.append(f"%{scenario.strip()}%")

    sql = "SELECT word, style, emotion, scenario, texture, frequency, nuance, reminder, definition FROM words"
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += f" LIMIT {limit}"

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


# ==========================================
# 3. 舊版相容：精準搜尋 API
# ==========================================
class QueryRequest(BaseModel):
    keyword: str

@app.post("/api/lookup")
def lookup_word(request: QueryRequest):
    results = query_word_bank(keyword=request.keyword, limit=1)
    if results:
        res = results[0]
        return {
            "status": "success",
            "suggestion": res.get("definition", ""),
            "tag": res.get("style", "")
        }
    return {"status": "not_found", "message": "目前詞彙庫中找不到這個詞彙"}


# ==========================================
# 4. 模組一：多條件進階搜尋 API
# ==========================================
class AdvancedSearchRequest(BaseModel):
    keyword: Optional[str] = ""
    style: Optional[str] = ""
    emotion: Optional[str] = ""
    scenario: Optional[str] = ""

@app.post("/api/search_advanced")
def search_advanced(req: AdvancedSearchRequest):
    try:
        data = query_word_bank(
            keyword=req.keyword or "",
            style=req.style or "",
            emotion=req.emotion or "",
            scenario=req.scenario or "",
            limit=30
        )
        return {"status": "success", "count": len(data), "data": data}
    except Exception as e:
        return {"status": "error", "message": f"搜尋失敗：{str(e)}"}


# ==========================================
# 5. 模組二：AI 沉浸式擴寫與暖身引擎 API
# ==========================================
class ExpandRequest(BaseModel):
    base_text: str
    style: Optional[str] = ""
    emotion: Optional[str] = ""
    scenario: Optional[str] = ""

@app.post("/api/expand_inspiration")
def expand_inspiration(req: ExpandRequest):
    prompt = f"""
    你是一位精通文學修辭與小說創作的寫作大師。
    請根據以下提供的基礎句子與標籤，進行一段「沉浸式擴寫」，幫助作家找回寫作手感。

    基礎句子：{req.base_text}
    風格設定：{req.style if req.style else '無特定風格'}
    情緒設定：{req.emotion if req.emotion else '無特定情緒'}
    情境設定：{req.scenario if req.scenario else '無特定情境'}

    請提供 3 種不同運鏡角度或修辭手法的擴寫版本（每個版本約 50-100 字），要求文字優美、氛圍感強烈、排版清晰，務必使用繁體中文。
    """

    try:
        text = generate_resilient(prompt)
        return {"status": "success", "data": text}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==========================================
# 6. 模組三：AI 盲點診斷室 API
# ==========================================
class CoachRequest(BaseModel):
    draft_text: str

@app.post("/api/writing_coach")
def writing_coach(req: CoachRequest):
    if not req.draft_text.strip():
        return {"status": "error", "message": "請提供需要診斷的草稿內容。"}

    prompt = f"""
    你現在是一位溫和且專業的小說總編輯。請針對以下新人的文稿，給出具體且具建設性的診斷：
1. 溫暖鼓勵：挑選 1 個寫得最好的亮點（如氛圍描寫、角色情緒）。
2. 盲點診斷：具體指出 2 個最明顯的情節盲點（例如：視角漂移、缺乏感官動作、對話不自然）。
3. 修改示範：針對其中一個盲點給予 1~2 句改寫範例。
    
    請用繁體中文回覆，排版條列清晰。

    【新人文稿】：
    {req.draft_text}
    """

    try:
        text = generate_resilient(prompt)
        return {"status": "success", "data": text}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==========================================
# 7. 模組四：AI 伏筆與設定追蹤器 API
# ==========================================
class BibleRequest(BaseModel):
    bible_text: str
    draft_text: str

@app.post("/api/story_bible_scan")
def story_bible_scan(req: BibleRequest):
    if not req.bible_text.strip() or not req.draft_text.strip():
        return {"status": "error", "message": "設定集與草稿皆不能為空"}

    user_input = f"""
【專案設定集】：
{req.bible_text}

【最新草稿】：
{req.draft_text}
"""
    prompt = f"{STORY_BIBLE_SCAN_PROMPT}\n\n{user_input}"

    try:
        text = generate_resilient(prompt)
        return {"status": "success", "data": text}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==========================================
# 8. 模組五：新手大綱精靈 API
# ==========================================
class OutlineRequest(BaseModel):
    genre: str
    goal: str
    antagonist: str
    worldview: str

@app.post("/api/outline_wizard")
def outline_wizard(req: OutlineRequest):
    sys_prompt = OUTLINE_PROMPTS.get(req.genre, OUTLINE_PROMPTS["fantasy_adventure"])

    user_input = f"""
【作家填寫的核心要素】
- 主角渴望的目標 / 信念：{req.goal}
- 面臨的對手 / 最大阻礙：{req.antagonist}
- 世界觀與時代背景：{req.worldview}
"""
    prompt = f"{sys_prompt}\n\n請根據以上資料協助梳理大綱與情節建議：\n{user_input}\n請使用繁體中文條列式呈現。"

    try:
        text = generate_resilient(prompt)
        return {"status": "success", "data": text}
    except Exception as e:
        return {"status": "error", "message": str(e)}