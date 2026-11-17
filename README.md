# PSST — 北科圖書館智慧座位系統（原生JS完整場景移植版）

以提供的 `PSStestaistudiov2-main.zip`（AI Studio / React版）為場景、座位邏輯與介面功能基準，重新製作**原生HTML + CSS + JavaScript**版本。**不需React、不需Vite、不需npm、不需打包建置。** 直接放到GitHub Pages的儲存庫根目錄即可部署。原始Three.js程序化建模程式（建築、桌椅、人物、背包、書籍、攝影機視野）已轉譯成ES module，沒有拿上一版平面座位表取代。

> 執行依賴瀏覽器WebGL與網路CDN載入Three.js；如無WebGL或無法存取Three.js CDN，會改成可點選的2D座位平面備援。雲端功能需要Supabase URL與Publishable Key；未設定時可直接使用完整情境展示模式。

## 1. 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | 入口、UI面板、外部ESM import map |
| `style.css` | 原版淺暖灰背景、白色卡片、極簡UI、RWD |
| `js/scene.js` | 從原版`Scene25D.tsx`轉譯：3D幾何、材質、相機、圖層、物件、raycast、狀態同步 |
| `js/data.js` | 從原版`mockLibraryData.ts`轉譯：**12 / 16 / 20 = 48個座位**與各座標設備 |
| `js/logic.js` | 從原版`seatLogic.ts`轉譯：狀態判斷、篩選、推薦評分 |
| `js/app.js` | 無React之互動介面、情境、登入、預約、館員及Supabase對接 |
| `config.js` | 可公開的Supabase連線設定 |
| `setup.sql` | **新版**資料庫、RLS、RPC、48席種子、Realtime事件 |
| `.nojekyll` | GitHub Pages直接發布靜態檔 |
| `docs/` | 來自原版的場景／資料／推薦邏輯原始TSX/TS檔，僅供對照，不參與執行 |

## 2. 不用Supabase，直接試玩

把檔案解壓縮至同一資料夾。由於程式使用ES modules，建議在該資料夾執行本機HTTP伺服器（Python範例）：

```bash
python -m http.server 8000
```

用瀏覽器開啟`http://localhost:8000/`；或直接先上傳GitHub Pages，**不填`config.js`就能使用本機情境展示模式**。正式網址與外部CDN都需要網路。直接以`file://`雙擊開啟可能受瀏覽器ESM跨來源限制，不建議。

操作路徑：

1. 上方切換三個自習空間：晨光木質靜讀室12席、玻璃中庭協作廳16席、星空階梯沉浸閣20席。
2. Three.js場景可拖曳旋轉、縮放、點選座位，切換等角／剖面／俯視及狀態／環境／攝影機三圖層。
3. 底部依日期、時段、設備、僅看空位、座位搜尋篩選；「動態智慧找位」選出符合條件座位及替代推薦。
4. 點選座位可預約／退訂／報到／暫離／返回，測試人物／書包／書籍偵測模擬、回報異常、換位、館員維護鎖定。
5. 點「情境模擬」：無預約占用、回報與一鍵換位、暫離保留、重置基準。
6. 「我的預約與追蹤」可看預約、回報進度及原版示範歷史；「館員監控台」含狀態統計、異常工單、座位篩選及模擬偵測控制。

展示模式的預約、館員身份、攝影機偵測都是**本機演示資料**，刷新頁面會還原，不會連線真實攝影機，也不會跨裝置同步。

## 3. 連接Supabase：需要修改舊版資料庫

**這次Supabase確實需要改寫。**舊版`PSStest04-main.zip`中的`setup.sql`建立的是三區各16席、共48席，與AI Studio原版的12 / 16 / 20不同；舊版`seats.id`為UUID，但這版用原始席位代碼（`P-01`等）做主鍵，以保留2.5D模型的位置與狀態對應。新版本也加入`vision`模擬狀態、報到／暫離、完整回報進度及原子換位。

**強烈建議開新的Supabase專案執行本ZIP的`setup.sql`。**不要在已有正式資料的舊專案直接執行：資料表結構不相容。若要沿用舊專案的真實預約／學生資料，請先備份並規劃主鍵對應遷移，不可以直接覆蓋或刪表。

在新Supabase專案：

1. 建立專案，進入SQL Editor。
2. 開啟本ZIP中的`setup.sql`，全選貼入SQL Editor後按Run。可到Table Editor確認`seats`有48筆、`P-01`至`P-12`、`A-01`至`A-16`、`L-01`至`L-20`。
3. 到Project Settings → API Keys取得**Publishable key**（通常為`sb_publishable_...`）與Project URL。在本ZIP的`config.js`填入：

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_...' // 公開金鑰
};
```

4. 在Supabase → Authentication → Providers（Email）確認Email登入開啟；若要求Email驗證，要先驗證才可登入。
5. 啟動網站，按右上角「登入／註冊」建立測試帳號。
6. 要設定館員管理權限，**由Supabase擁有者**在SQL Editor手動執行（先確認帳號已註冊）：

```sql
update public.profiles set role='admin' where email='your-email@example.com';
```

登出再登入即可切換館員角色，**不能由一般學生在網站上自行取得管理權限。**

### 正式連線與演示差異

| 功能 | 本機展示 | Supabase正式連線 |
|---|---|---|
| 2.5D座位場景、物品與視角 | 保留 | 保留 |
| 座位篩選／智慧推薦 | JS | JS，搭配真實預約狀態 |
| 登入註冊 | 模擬學生 | Supabase Auth |
| 座位預約／退訂／報到／暫離／回座 | 本機記憶體 | Supabase RPC + 唯一約束 |
| 一鍵換位 | 本機記憶體 | 單一資料庫交易RPC |
| 異常回報與館員處理 | 模擬資料 | Supabase reports / 權限檢查RPC |
| 館員維護鎖定／人工攝影機模擬 | 任意操作 | **管理員限定**並寫入資料庫 |
| 四種核心情境 | 直接修改本機資料 | **僅本機預覽，不修改正式資料**；按重設退出 |
| 跨裝置狀態同步 | 無 | Realtime變更事件 + 30秒輪詢備援 |
| 攝影機辨識 | 手動模擬 | 手動模擬，**沒有接真實影像或AI** |

**權限與隱私**：學生不能讀取其他預約者的身分資料。`get_seat_snapshot`只輸出某日期/時段哪些座位被預約、其到席狀態與是否為本人；館員權限在資料庫RPC進行檢查，前端只放可公開的Publishable Key，**絕不可放`service_role`或`sb_secret_`**。本版使用SQL RPC保護管理寫入，**不需要額外部署Edge Functions**。

> 警告：這是研究／展示性系統的雲端原型。任何登入者可提交異常報告並觸發座位凍結，正式對外上線前仍應加上防濫用限制、管理審核策略、隱私政策與操作稽核。此版本沒有宣稱是圖書館正式營運產品。

## 4. 發布GitHub Pages（不需建置）

1. 將ZIP**解壓縮後檔案**直接上傳到GitHub repository根目錄，確認根目錄可看到`index.html`、`config.js`、`setup.sql`、`js/`、`style.css`。
2. 到GitHub repository → Settings → Pages → Build and deployment。
3. Source選Deploy from a branch，分支選`main`、資料夾選`/(root)`，儲存。
4. 用GitHub提供的網址開啟。所有本地CSS/JS都是`./`相對路徑，支援`https://帳號.github.io/儲存庫/`子路徑。
5. 如果填入Supabase，Authentication設定內可將GitHub Pages公開網址加入允許的Site URL / Redirect URLs（尤其是日後啟用OAuth或Magic Link時）。

## 5. 驗收方式

- [ ] 首頁能切換3個不同模型，座位數為12/16/20；可切換3D相機及圖層。
- [ ] 點座位會顯示右側詳細資訊、設備、偵測、推薦；拖曳不應觸發點擊。
- [ ] 4個情境都能操作，人物/背包/書籍可獨立切換，異常後推薦席位。
- [ ] 本機模式中可預約、報到、暫離、返回、回報、換位、館員解鎖、重置。
- [ ] Supabase連線後學生無法使用館員功能；管理員可調整座位狀態與回報。
- [ ] 兩台裝置使用同一日期/時段不能同時成功預約同一座位。
- [ ] 一台裝置預約後另一台裝置刷新或等待同步可看到占用；無法讀出其他預約者Email。
- [ ] 正式連線中使用情境模擬不會寫入資料庫，重設後返回雲端座位狀態。
- [ ] GitHub Pages子路徑正常載入CSS與JS。

## 6. 實測範圍與已知限制

已針對原生JS模組進行語法檢查，並在受限瀏覽器環境驗證2D備援顯示、三區切換、4個情境入口、座位選取、異常畫面、個人預約與館員模擬控制。**環境封鎖外部CDN，無法完整載入Three.js以實際檢驗WebGL畫面**；3D模型程式移植自原版並保留，但須在可連網的實際瀏覽器再確認渲染、效能與視角。未提供Supabase測試專案金鑰，**SQL/RPC、Auth、Realtime尚未實際連接雲端做端對端驗證**；正式上線前請依第5節驗收。

其他限制：
- 真正攝影機影像辨識**未實作，也不需要**；僅依手動模擬的三個偵測旗標判斷座位異常。
- 原版學生預約歷史是兩筆硬編模擬資料；正式連線模式只顯示現有預約及本次分頁操作紀錄，沒有完整跨期歷史稽核報表。
- 為避免洩漏他人身份，正式連線模式不會像原版硬編展示資料那樣在他人的座位詳細資訊中顯示學生姓名／學號。
- 原始各畫面已改為原生JS DOM介面，仍保留視覺系統、核心元件與操作流程，但不是逐像素重建React JSX；在不同瀏覽器上會有些許字體／間距差異。
- 正式連線需要可存取Supabase與外部CDN；WebGL失敗自動使用2D備援，這種情況下不能稱為3D完成測試。

以上以原版AI Studio ZIP中的功能及元件命名為基準，不沿用先前簡化網站的平面席位版面。
