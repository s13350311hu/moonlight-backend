import os
import sqlite3
import pandas as pd

# 自動取得當前腳本所在的目錄
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 嘗試在當前目錄或上一層目錄尋找 Excel
excel_candidates = [
    os.path.join(BASE_DIR, "月下語詩_詞彙標註(1).xlsx"),
    os.path.join(BASE_DIR, "..", "月下語詩_詞彙標註(1).xlsx"),
    os.path.join(BASE_DIR, "月下語詩_詞彙標註(1)_2.xlsx"),
    os.path.join(BASE_DIR, "..", "月下語詩_詞彙標註(1)_2.xlsx"),
]

excel_file = None
for path in excel_candidates:
    if os.path.exists(path):
        excel_file = path
        break

print(f"--> 當前工作目錄: {os.getcwd()}")
print(f"--> 腳本所在目錄: {BASE_DIR}")

if not excel_file:
    print("❌ 錯誤：找不到 Excel 詞彙檔案！請確認檔案已放置於專案目錄或 backend 資料夾中。")
    exit(1)

print(f"✅ 找到 Excel 檔案: {excel_file}")
db_file = os.path.join(BASE_DIR, "word_bank.db")

if os.path.exists(db_file):
    os.remove(db_file)
    print("🔄 已移除舊的 word_bank.db")

print("⏳ 正在讀取 Excel「全部詞彙」頁籤（資料量約 16 萬筆，讀取約需 20~40 秒，請稍候）...")

use_cols = ['詞', '風格', '情緒', '情境', '質感', '常用度', '語感', '提醒', '釋義（已去書證）']
df = pd.read_excel(excel_file, sheet_name="全部詞彙", usecols=use_cols)

print(f"📊 讀取完成！共 {len(df)} 筆資料，正在整理欄位...")
df = df.fillna("")

df = df.rename(columns={
    '詞': 'word',
    '風格': 'style',
    '情緒': 'emotion',
    '情境': 'scenario',
    '質感': 'texture',
    '常用度': 'frequency',
    '語感': 'nuance',
    '提醒': 'reminder',
    '釋義（已去書證）': 'definition'
})

print("💾 正在寫入 SQLite 資料庫 (word_bank.db)...")
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

df.to_sql("words", conn, if_exists="replace", index=False)

print("⚡ 正在建立查詢索引 (Index)...")
cursor.execute("CREATE INDEX idx_word ON words(word);")
cursor.execute("CREATE INDEX idx_style ON words(style);")
cursor.execute("CREATE INDEX idx_emotion ON words(emotion);")
cursor.execute("CREATE INDEX idx_scenario ON words(scenario);")

conn.commit()
conn.close()

print(f"🎉 轉檔大功告成！資料庫檔案已產生：{db_file}")