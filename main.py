from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel

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
    df_literary = pd.read_excel('文學詞彙替換庫.xlsx')
    print("✅ 成功載入文學詞彙替換庫")
except Exception as e:
    df_literary = None
    print(f"❌ 找不到 Excel 檔案或讀取失敗：{e}")

# 定義前端傳送過來的資料格式
class QueryRequest(BaseModel):
    keyword: str

# 建立 API 接收點
@app.post("/api/lookup")
def lookup_word(request: QueryRequest):
    target_word = request.keyword
    
    if df_literary is not None:
        # 在資料庫中尋找使用者輸入的關鍵字
        lit_row = df_literary[df_literary['關鍵字'] == target_word]
        if not lit_row.empty:
            replace_suggestion = lit_row.iloc[0]['替換建議']
            lit_tag = lit_row.iloc[0]['風格標籤']
            return {
                "status": "success",
                "suggestion": replace_suggestion,
                "tag": lit_tag
            }
            
    return {"status": "not_found", "message": "目前詞彙庫中找不到這個詞彙"}