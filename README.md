# 知行圖書館智慧座位系統（GitHub Pages + Supabase）

本版本將原始 Google AI Studio / React + Vite + Tailwind 專案改為**原生 HTML、CSS、JavaScript**。前端不需 npm、不需建置，`index.html` 位於專案根目錄，可直接由 GitHub Pages 發布。資料與帳號由 Supabase 提供。

## 1. 專案內容

- `index.html`：網站入口。
- `style.css`、`app.js`：原生前端介面與功能。
- `config.js`：唯一前端設定檔，填入 Supabase URL 與 Publishable Key。
- `setup.sql`：資料表、RLS、觸發器、RPC 函式、Realtime 設定及 48 個初始席位。
- `README.md`：本部署說明。

## 2. 建立 Supabase 專案

1. 登入 [Supabase](https://supabase.com/) 並建立一個專案。
2. 進入 **Project Settings → API**（部分介面顯示 API Keys）。
3. 複製 **Project URL** 及 **Publishable key**。只使用 Publishable key；不可將 `secret` 或 `service_role` key 放入前端。
4. 在下載的專案中以 GitHub 網頁介面或其他文字編輯器打開 `config.js`，填入兩個值：

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://你的專案代碼.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_你的公開金鑰"
};
```

儲存後提交到 GitHub。這個檔案是前端設定，不是私密金鑰保管處。

## 3. 建立資料庫

1. 在 Supabase 專案左側選 **SQL Editor**。
2. 開啟本 ZIP 的 `setup.sql`，全選複製。
3. 貼到 SQL Editor，按 **Run**。
4. 執行完成後，至 **Table Editor** 確認有 `profiles`、`seats`、`reservations`、`reports` 四張表；`seats` 預設 48 筆，分成 P-01～P-16、A-01～A-16、L-01～L-16。
5. 若需註冊後立即登入，至 **Authentication → Providers → Email** 確認 Email provider 啟用。若開啟 Confirm email，註冊者需先完成信箱驗證。

## 4. 設定館員管理員

1. 先用網站註冊你自己的帳號。
2. 在 Supabase → **Table Editor → profiles** 找到該帳號資料。
3. 將 `role` 從 `student` 改為 `admin`，儲存。
4. 重新登入網站，頂端會出現「館員管理」頁籤。

也可在 SQL Editor 執行 `setup.sql` 最後的範例 UPDATE，並將 Email 換成你的帳號。**不要讓一般使用者自行更新 profiles.role**；RLS 已禁止使用者修改角色。

## 5. 發布到 GitHub Pages

1. 將 ZIP 解壓後的所有檔案上傳到 GitHub repository 根目錄（不要只上傳外層資料夾）。
2. 確認 repository 根目錄直接看得到 `index.html`、`app.js`、`style.css`、`config.js`。
3. GitHub repository → **Settings → Pages**。
4. 在 **Build and deployment** 選 **Deploy from a branch**。
5. Branch 選 `main`（或你的主要分支），資料夾選 `/(root)`，按 Save。
6. 等待 GitHub Pages 部署完成，使用 GitHub 顯示的網址開啟。所有站內資源採相對路徑 `./`，支援 `https://帳號.github.io/儲存庫名稱/` 子路徑。

更新網站時，只要提交修改後的檔案，GitHub Pages 會自動重新發布。

## 6. 功能操作與驗收

### 學生端
1. 開啟網站，確認三個空間及 48 個席位顯示。
2. 註冊或登入。
3. 選擇日期、時段及空間，點擊綠色可預約座位，確認預約。
4. 在另一個瀏覽器或無痕視窗開啟網站，選相同日期與時段，該席位應顯示為已預約且不能再點選。
5. 到「我的預約」取消尚未開始的預約，回到座位總覽確認釋出。
6. 登出後確認仍可瀏覽座位，但無法完成預約。

### 館員端
1. 依第 4 節將自己的帳號設為 admin，重新登入。
2. 在「館員管理」測試座位暫停開放與解除維護。
3. 學生登入後可在可預約座位的詳情視窗按「回報座位問題」送出文字回報；管理員可查看回報並標記結案。一般帳號不能讀取或修改管理資料。

### 部署檢查
- [ ] `config.js` 已填入正確 Supabase URL / Publishable Key。
- [ ] `setup.sql` 已完整執行，無 SQL 錯誤。
- [ ] GitHub Pages 來源為主要分支的根目錄。
- [ ] 網站網址包含 repository 子路徑時 CSS / JS 仍可載入。
- [ ] 註冊、登入、登出正常。
- [ ] 同時段重複預約會被資料庫拒絕。
- [ ] 另一個瀏覽器可看到座位占用狀態更新。
- [ ] 非管理員無法使用管理功能。

## 7. 安全與權限設計

- 前端只持有 Supabase Publishable Key；沒有 service-role 或 secret key。
- Supabase Auth 負責註冊、登入與 Session。
- `profiles` 只允許本人讀取；角色只能由專案管理者在 Supabase 後台變更。
- `seats` 可公開讀取；座位維護狀態僅管理員可更新。
- `reservations` 只允許本人讀取與取消。前端不讀取其他人的預約紀錄。
- `get_reserved_seat_ids(date,slot)` 是資料庫函式，只回傳該時段被占用的 seat UUID，不暴露預約者身分或其他預約欄位。
- `book_seat(...)` 在資料庫端檢查登入、日期範圍、維護狀態與唯一性，避免同時搶位。
- `reports` 允許登入者新增，僅管理員可讀取及更新。
- Realtime 僅作為變更通知；收到通知後前端重新查詢受 RLS / RPC 保護的資料。

## 8. 與原始 AI Studio 版本的差異

原專案包含 React、Vite、Tailwind、lucide-react，以及以模擬資料驅動的 2.5D 場景、攝影機視覺偵測模擬、席位檢視抽屜、情境模擬、館員監控與學生紀錄等元件。本次依「無建置、可直接 GitHub Pages」要求，重做為原生網頁：

- **保留並可實際使用**：三個自習空間、48 個座位、空位/已預約/維護狀態、日期與時段篩選、搜尋、Supabase 註冊登入、原子化預約、個人預約查詢/取消、跨瀏覽器占用同步、管理員維護鎖定、異常回報管理資料表。
- **簡化**：座位視覺化由原本 2.5D 互動場景改為響應式座位格；設備資訊採簡化呈現；學生紀錄只呈現目前與未來預約。
- **未移植**：原本的 AI 攝影機人/包/書辨識、即時視覺模擬控制、3D/2.5D 鏡頭、複雜推薦演算法、情境模擬與原始示範歷史紀錄。原始內容是前端 mock / 模擬資料，沒有實際攝影機或 AI 後端，故不以假資料假裝成真實偵測。
- 沒有使用 Gemini API、Node.js server 或 Edge Function；一般登入由 Supabase Auth 處理，預約與權限驗證由 SQL RPC / RLS 執行，因此不需要部署 Edge Function，也不需要額外申請 API 金鑰。

## 9. 已檢查與需上線後驗證

**已在交付檔案層級檢查：**
- 根目錄有 `index.html`，資源使用相對路徑。
- 前端為原生 HTML/CSS/JS，無 npm / build 依賴。
- 前端設定欄位與 Supabase 欄位名稱一致。
- SQL 建立的表名、欄位、RPC 名稱與前端呼叫一致。
- RLS 對學生預約資料採本人讀取；占用狀態走只回傳 seat UUID 的 RPC。
- 預約唯一性由資料庫約束與 RPC 保證；管理員操作由 `is_admin()` 在資料庫端驗證。
- 不包含 Edge Function，也不需要服務端私密金鑰。

**必須在你的 Supabase / GitHub 環境驗證：**
- SQL Editor 執行結果、Auth Email 設定與郵件驗證流程。
- `config.js` 的專案 URL / Publishable Key 是否正確。
- 管理員角色提升後是否可正常顯示館員管理頁籤。
- GitHub Pages 實際部署、瀏覽器跨來源請求及 Realtime 連線。
- 跨使用者的預約資料不會透過一般查詢洩漏；由於預約明細採本人 RLS，其他使用者的 Realtime row event 可能無法送達。前端另有每 20 秒刷新一次的占用狀態備援；跨帳號驗收通常會在 20 秒內更新，亦可手動重新整理。

## 10. 注意事項

本系統目前以每個日期、時段作為預約單位；不支援自訂起訖時間。取消按鈕只顯示未來或今天的預約；資料庫僅允許取消尚未過去日期的紀錄。若要公開給大量使用者使用，請在正式啟用前自行設定 Supabase 專案的備份、使用量與 Auth 郵件政策。
