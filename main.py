from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

# 設定 CORS，讓前端 (React) 能夠順利跟後端通訊
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 啟動時自動載入你剛剛放進來的 Excel 資料庫
try:
    # 🌟 修改點 1：指定讀取 '工作表1'，並把空值替換為空字串，避免後續文字比對出錯
    df_literary = pd.read_excel('文學詞彙替換庫.xlsx', sheet_name='工作表1')
    df_literary = df_literary.fillna("") 
    print("✅ 成功載入文學詞彙替換庫")
except Exception as e:
    df_literary = None
    print(f"❌ 找不到 Excel 檔案或讀取失敗：{e}")

# ==========================================
# 保留原本的舊版：精準搜尋 API (讓舊版前端維持運作)
# ==========================================
class QueryRequest(BaseModel):
    keyword: str

@app.post("/api/lookup")
def lookup_word(request: QueryRequest):
    target_word = request.keyword
    
    if df_literary is not None:
        # 在資料庫中尋找使用者輸入的關鍵字
        lit_row = df_literary[df_literary['關鍵字'] == target_word]
        if not lit_row.empty:
            replace_suggestion = str(lit_row.iloc[0].get('替換建議', ''))
            lit_tag = str(lit_row.iloc[0].get('風格標籤', ''))
            return {
                "status": "success",
                "suggestion": replace_suggestion,
                "tag": lit_tag
            }
            
    return {"status": "not_found", "message": "目前詞彙庫中找不到這個詞彙"}


# ==========================================
# 🌟 第一階段全新：多條件搜尋 API
# ==========================================
class AdvancedSearchRequest(BaseModel):
    keyword: Optional[str] = ""
    style: Optional[str] = ""
    emotion: Optional[str] = ""
    scenario: Optional[str] = ""

@app.post("/api/search_advanced")
def search_advanced(req: AdvancedSearchRequest):
    if df_literary is None:
        return {"status": "error", "message": "伺服器資料庫尚未準備好"}

    results = []
    for index, row in df_literary.iterrows():
        match = True 
        
        # 檢查關鍵字 (如果前端有填，且關鍵字不在原始詞或替換建議中，則淘汰)
        if req.keyword:
            if req.keyword not in str(row.get('關鍵字', '')) and req.keyword not in str(row.get('替換建議', '')):
                match = False
                
        # 檢查風格標籤
        if req.style and req.style not in str(row.get('風格標籤', '')):
            match = False
            
        # 檢查情緒標籤
        if req.emotion and req.emotion not in str(row.get('情緒標籤', '')):
            match = False
            
        # 檢查情境標籤
        if req.scenario and req.scenario not in str(row.get('情境標籤', '')):
            match = False
            
        # 如果過關斬將後 match 還是 True，就加入結果清單
        if match:
            results.append({
                "keyword": str(row.get('關鍵字', '')),
                "suggestion": str(row.get('替換建議', '')),
                "style": str(row.get('風格標籤', '')),
                "emotion": str(row.get('情緒標籤', '')),
                "scenario": str(row.get('情境標籤', ''))
            })
            
    # 回傳找到的所有結果 (最多回傳前 10 筆，避免前端畫面塞爆)
    return {"status": "success", "data": results[:10]}
