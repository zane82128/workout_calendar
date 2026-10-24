# 系統與資料的白話說明

頁首外觀（2026-10-24）：ui.svg 新增 gear symbol，open-settings 沿用原 ID／事件與 dialog，aria-label 保存設定名稱。CSS 放大標題與品牌圖示，窄版另縮放，不改資料或服務。

gear 後續改為八齒描邊與中心圓孔，圖示局部採 geometricPrecision，避免繼承 crispEdges 使細線鋸齒化；其餘圖示仍維持原像素風。

## 年月滑輪（2026-10-24）

日期牌只以 styles.css 的 #date-title 及裝飾偽元素呈現，共用主題 gold/card-secondary/edge；保留 h2 與完整日期輔助標籤，不加入按鈕角色或事件。

month-picker.js 管理暫存年月、確認與取消；兩欄以 CSS scroll-snap 對齊中央選取格，每格 44px，支援觸控、滑鼠及方向鍵。main.js 分開保存瀏覽月份 calendarMonth 與紀錄日期 view.date，依月產生完整週列。schedule-date-input 隱藏保留舊更新快照相容；新快照另存瀏覽月份，滑輪草稿不跨更新保存。無新持久資料、依賴或外部服務。

滑動修正：移除 scroll 事件後 140ms 的程式定位，避免與持續拖動、慣性或 smooth scroll 競爭；scroll 僅被動更新最近格的草稿與 ARIA，且只更新前後兩個選項。滑輪選項覆寫全域 scroll-margin-top 為 0，防止原導航避讓距離改變 CSS snap 中心；容器含邊框 222px，內部恰為五個 44px 格。日期列改顯示 MM/DD，完整日期保留於 aria-label。

## 混合版介面（2026-10-23）

index.html 將目前動作提升為記錄卡標題，main.js 以安全 textContent 建立分類／名稱 span；移除 current-weight DOM 與寫入，原 comparison 的資料計算不變。完成區增加紀錄筆數；休息 summary 的標籤及剩餘時間分開更新，圖示不被 textContent 覆寫。原表單 ID、更新草稿與計時儲存維持不變。

新增 `src/icons/ui.svg` 為手寫像素 SVG symbol，槓鈴／日曆／計時／加號共用本機資源；建置沿用 icons 複製、雜湊及預快取。產物檢查將 SVG fragment 與資源路徑分開核對，並檢查 symbol ID 存在。styles.css 的 Hybrid 區塊處理兩主題卡片、字級與窄螢幕，使用既有 Fusion Pixel 字型，無新增字體下載服務。ui-map 設定同步移除已退休欄位。

## 有氧資料（2026-10-22）

`cardio.js` 管理分鐘／次數的驗證、完成與比較。原儲存物件新增可選 `cardioEntries`（id、exerciseId、名稱／分類快照、dateKey、value、unit、時間戳）；unit 為 minutes 或 reps。以動作、日期、單位去重，與 completedEntries 的 kg 分開，避免舊 App 將時間誤當重量。schema/dataVersion 仍為 2，已知舊 v2 會保留未知欄位但不呈現有氧；回退舊版會暫時看不到新有氧紀錄。

第一次加入 cardioEntries 前先備份原字串至 `workoutCalendar.backup.beforeCardio`，失敗則不寫入。decode 驗證數值、日期、唯一鍵與跨重量／有氧 ID；main.js 合併顯示日曆與完成清單，training 共用合併查詢判斷待做。更新快照沿用原輸入欄位，還原後依動作建立可用單位再還原選擇。所有資料仍在本機，無新增外部服務。

## 圖示資源（2026-10-22）

`designs/app-icon/shield-master.png` 保存原稿，`tools/export-icons.ps1` 輸出 32、180、192、512 PNG。index 引用分頁及 Apple 圖示，manifest 引用 192／512，512 為 any maskable。建置複製與預快取圖示，檢查資源及 PNG 尺寸；保留舊 SVG，不修改 start_url 或訓練資料。


2026-10-22 App shell：`app-shell.js` 管理設定 dialog、關閉／Escape、更新快捷入口，以及用 ResizeObserver 提供實際導航高度。CSS 的 #app-navigation 使用 sticky 與 safe-area 偏移，與一般頁首分開；主內容控制項有 scroll-margin，避免原生聚焦捲動時被導航遮住。theme.js、feedback.js 與 update-manager.js 仍綁同一組元素 ID，只搬動 DOM 到設定面板，沒有重建／複製表單。

main.js 的 pageScroll 保存 record/tasks 各自 window.scrollY，切頁時同步還原，snapshot 包含 pageScroll、settingsOpen；初始化快照後用 requestAnimationFrame 在內容還原完才捲動。設定位於 app-root 外，freeze 也會將設定設 inert；選動作面板另行關閉及停用。更新 ready 不自動開設定，而顯示 #update-shortcut；原 app-update 浮層樣式在設定內覆寫為一般區塊。沒有新增永久 localStorage 欄位或服務；位置記憶是畫面與更新快照，不是雲端同步。

2026-10-22 kg/lb：weight-units.js 封裝 1 lb = 0.45359237 kg 的換算、格式與輸入單位。completedEntries.weight/unit 保持 canonical kg，避免破壞現有 v2 比較與解碼；新增可選 inputUnit/inputWeight 記錄該最高成績的原輸入單位。未帶新欄位的紀錄視作 kg；已知舊 v2 程式可能更正 canonical weight 而未同步 metadata，因此只有 metadata 與 weight 相符才採用，否則退回 kg，不以 metadata 覆蓋實際重量。這是加法欄位，不改資料版本、不回寫舊紀錄。

main.js 的 weightPrefill 留存預填欄對應的精確 kg；使用者輸入或改單位即清除，避免將保留數字誤當成換算。快照新增 weightPrefill 並於呈現前還原 entry-unit，使比較及草稿單位一致；更正表單同樣在未更動時保留原精度。沒有新增單位偏好雲端或本機永久設定。

2026-10-22 分類介面：`exercise-groups.js` 是三處共用的 DOM 分組元件，使用既有 categoryOf/exerciseOrder，不新增資料欄位或服務；原生 details 以穩定 ID、data-category 保存展開狀態。main.js 管理原生 dialog 單選／搜尋，training-ui.js 使用相同元件多選。原隱藏 exercise-select 保留內部目前值及舊更新快照相容，不再是使用者操作入口；搜尋僅影響面板結果，不改 view.exerciseId 或 weightDirty。選取才切換；freeze 更新時關閉並停用 dialog，避免 modal 在 App inert 期間仍可操作。舊版帶新增動作草稿的快照會展開新收納區，避免草稿被隱藏。tools/ui-map.config.json 已改指向新選擇按鈕並開啟新增表單製圖。

## 組合、待做與到期提示（2026-10-21）

`training.js` 提供明確指定 `zh-Hant-TW-u-co-stroke` 的類內排序、分類前綴、組合與匯入規則；`training-ui.js` 只操作 DOM 並透過原 store 交易，記錄頁仍由 main.js 負責重量。新增可選 `trainingSets`（id/name/exerciseIds）與 `plannedExercises`（dateKey/exerciseId/exerciseName/category），都在原 workoutCalendar.v1 中；是可選加法欄位，schema/dataVersion 仍為 2，已知 v2 修復來源會保留未知欄位。不得回退會丟未知欄位的原始 v1 版。

decode 驗證新欄位，舊資料缺欄位仍可讀；第一次寫入任一新欄位前保存原字串至 `workoutCalendar.backup.beforeTrainingSets`，備份失敗不寫新資料。這仍是會隨網站資料清除的本地副本，不是外部備份。待做項目不轉為 completedEntries；顯示時排除當日已有完成的同動作，所以刪成績後原待做可再次顯示。組合動作參照穩定 ID，每日清單另外存名稱／類別快照。

更新快照新增 training 編輯 ID／名稱／勾選順序／管理子頁，其他分頁有組合草稿時 canPrepare 阻擋靜默更新；明確套用的本頁可保存及還原快照。rest-timer.js 以獨立十秒期限控制本頁視覺，與最多一分鐘音效分離，renderTimer 更新 class 與 summary，無資料格式變更。視覺提示不跨重載重播。既有 localStorage 同時編輯衝突限制仍存在。

回報整合進度（2026-10-21）：src/feedback.js 管理表單，指向使用者提供的公開 Apps Script /exec（不是密鑰）。POST 僅含 id/title/body/version，text/plain JSON、cors、omit credentials，20 秒逾時。sessionStorage 的 workoutCalendar.feedbackDraft 保存文字及待確認 request，與訓練 localStorage 分離；成功後清除。更新 snapshot 排除回報欄位，避免舊 snapshot 重填已送出的草稿；更新 save 持久化本分頁草稿，canPrepare 在送出中或草稿保存錯誤時拒絕更新。其餘測試不真送回報，以攔截回應驗證狀態。Apps Script 不納入離線快取，離線不排隊自動送出。

回報原型（2026-10-21）：services/feedback/Code.gs 獨立部署到 Apps Script，擁有者授權寫入私人 Reports 試算表；不打包到 App。tools/feedback-preview.mjs 僅在 localhost 提供開發連線頁。原型使用可讀回應的跨站 POST 與持久編號去重，鎖定寫入後 flush 才回 ok；瀏覽器遇到未知結果不宣稱成功。尚無真實 /exec、線上跨站驗收或 src/ 整合，現行訓練資料流不變。見 [設定](feedback-setup.md)。

休息重置（2026-10-21）：rest-timer.js 新增 reset，先停止本頁音訊，再以現有 store.transaction 將剩餘秒數設為 restConfig 總秒數、running=false、startedAt=null。沿用原格式與資料櫃，不新增服務或遷移。其他分頁已在播放的音訊沒有新增跨頁停止協定。

2026-10-21 B 版：只調整 index.html 的當天最高位置與主題選項文案、styles.css 的緊湊排列，以及 main.js 的空成績字級 class。保留所有操作與快照使用的 ID；日曆 summary 在日期列旁定位，展開內容仍在一般文件流，不遮住動作表單。沒有新增儲存欄位、依賴或資料遷移。

發版例外（2026-10-20）：Release PWA 在 main 接受 mobile_verified 或明確的 repair_release。後者只放寬部署前實機門檻，仍依序驗證及部署同份 dist/，不改 `/workout_calendar/src/` 或資料格式。修復模式在工作摘要標記 Android 部署後待驗收、iOS 未驗證。詳細授權與操作見發版 SOP。

更新：2026-10-20，依目前分支實作及本地測試；不是線上環境稽核。產品規則見 `docs/product/spec.md`，選擇原因與狀態見 `docs/decisions/README.md`。

## 用戶輸入之後發生什麼

以完成「臥推 40 kg」為例：

1. 瀏覽器先下載 App 程式；動作選單來自本地已儲存的清單，第一次使用補入預設選項。
2. 填寫或調整重量尚不算完成。按「完成」才檢查日期及重量，依動作識別碼與日期建立或提高當天最高，同時保存當下名稱與分類。
3. 每次寫入先讀取儲存中的最新資料，在副本中操作並驗證，再寫回 localStorage；寫入成功才更新畫面及顯示一秒通知，失敗不顯示假成功。
4. 日曆依新版完成／舊版紀錄分別標橘／灰；上次與最高只讀取新版 completedEntries，在裝置內計算。沒有容量圖表。
5. 之後開啟 App，從相同瀏覽器的網站儲存空間讀回；沒有向 GitHub 下載你的個人訓練紀錄。

儲存失敗會提供錯誤訊息，保留輸入及原資料；更新流程也會暫緩套用。損壞或較新版本資料會阻止覆寫並提供重試，不自動清除資料。

## 三種儲存空間不能混為一談

| 空間 | 白話用途 | 本專案放什麼 |
| --- | --- | --- |
| localStorage | 瀏覽器內的網站資料櫃 | `workoutCalendar.v1`：schemaVersion 2、動作、completedEntries 新版完成、entries 舊版只讀，以及原備忘錄／計時欄位；舊格式首次遷移前另存原始字串至 workoutCalendar.backup.beforeWeightV2 |
| sessionStorage | 這個分頁暫存的工作便條 | `workoutCalendar.updateSnapshot`：更新前的頁面、草稿與選項，重載後還原 |
| Cache Storage | App 檔案的離線副本 | HTML、JS、CSS、圖示等；新流程以發版版本分開，完整下載後才切換 |

關閉 App 不等於主動清掉 localStorage，但它不是永久備份；網站資料仍可能被用戶或瀏覽器移除。儲存空間受 origin（通訊協定、網域、連接埠）及瀏覽器儲存環境區隔；不同裝置不自動共享。本地預覽與 github.io 的紀錄也分開。iOS／Android 安裝模式與一般分頁是否共享資料須依實機驗證，不能保證所有情況相同。

## 外部服務與資料邊界

外觀由 `src/theme.js` 管理：`workoutCalendar.theme` 獨立於訓練資料，值為 system/light/dark；系統變更與其他分頁的偏好變更會同步畫面。偏好無法讀取時採系統，無法保存時提示但不中斷記錄。CSS 共用兩款色彩變數及本地裝飾。Fusion Pixel 2026.10.16 台灣字形 WOFF2 約 672 KiB，建置產生雜湊資源並納入既有完整離線快取；授權及組件聲明隨產物發布，不在使用時向字型 CDN 請求。字型首次載入前可短暫顯示系統字型。來源與授權見 `src/fonts/README.md`。

| 服務／工具 | 做什麼 | 不應誤認為 |
| --- | --- | --- |
| GitHub repo | 保存程式、文件及版本歷史 | 用戶訓練紀錄的備份庫 |
| GitHub Pages | 對外提供 App 靜態檔案 | 訓練資料庫或登入服務 |
| GitHub Actions | 預計執行自動檢查及手動發版；工作流程已加入 repo | 已經確認在線上成功執行的發版機制 |
| npm 套件來源、Playwright 瀏覽器下載 | 開發時取得建置／測試工具 | 用戶每次開 App 都要安裝的東西 |

本分支 App 的網路程式用來下載本站資源及檢查版本；未見主動上傳訓練資料的 API、登入、付款、廣告或分析 SDK。這不等於主機沒有存取紀錄，也不等於完成隱私與安全稽核。GitHub 帳號方案、實際流量、Actions 用量與帳單未知；不能只根據 repo 宣稱永遠零成本。

## 檔案各自負責什麼

文件已按用途集中至 `docs/product/`、`architecture/`、`decisions/`、`release/`、`validation/`；歷史日誌放 `archive/`，入口為 [文件導覽](../README.md)。這是檔案分類，不改 App 執行架構或正式入口。

| 檔案／目錄 | 責任 |
| --- | --- |
| `src/index.html`、`styles.css` | 四頁畫面、欄位與外觀 |
| `src/main.js` | 兩頁呈現、操作事件、日曆、草稿還原及各模組協調 |
| `src/records.js` | 獨立於畫面的日期、重量、每天最高、更正與比較規則 |
| `src/storage.js` | 舊格式備份、v2 驗證、最新資料讀取與交易式寫入，保留未知／退休欄位 |
| `src/rest-timer.js` | 時間戳倒數、開始／暫停、休息完成及最多一分鐘的 Web Audio 鈴聲 |
| `src/preset-exercises.js` | 預設動作及七個分類；不是訓練歷史 |
| `src/update-manager.js` | 檢查新版、顯示提示、儲存頁面狀態及協調重載 |
| `src/sw.js` | 建置時填入版本的 Service Worker 範本；管理完整離線版本與資源請求 |
| `tools/build.mjs` 等 | 打包、檢查、預覽、UI 製圖；不是用戶介面 |
| `tests/records.test.mjs`、`tests/product.test.mjs`、`tests/update.test.mjs` | 資料規則、瀏覽器產品操作及升級；release 依序執行三者，測試使用隔離資料 |
| `dist/` | 工具產生的部署產物；不應手動修改或提交 |
| `release.config.json`、`.github/workflows/` | 部署路徑及檢查／發版流程定義 |

使用原生網頁技術，沒有後端服務、雲端資料庫或前端框架。Node.js／npm 用於開發與發版，使用者在瀏覽器使用 App 不需要安裝它們。

## 新更新流程與限制

程式修改 → 工具產生版本與雜湊檔名 → 自動測試 → 手動觸發正式工作流程 → 上傳同一份已驗證產物 → 用戶檢查到新版 → 背景完整下載 → 提示用戶 → 儲存及確認其他分頁 → 重載新版。

這是新分支的設計與實作，不是今天已查證的線上發布狀態。離線、不開 App、其他分頁仍在訓練或用戶選擇稍後，都可能繼續使用舊版。完整規格及首次導入限制見 `docs/release/sop.md`。

每次交易重新讀取最新資料，並透過 storage 事件更新其他頁面而不覆寫未送出草稿；但 localStorage 沒有跨分頁原子鎖，精確同時編輯同一紀錄仍非完整同步／衝突合併。新版以文字節點呈現動作與舊 note，完成及更正驗證有限非負數及有效非未來日期；這些改進不等同完整安全稽核。

## 資料邊界（已本地實作，未部署）

- 舊資料與新版完成紀錄必須能明確區分；不替舊資料自動加上完成意義，不改寫舊 lb、次數、組數及備註。
- 新版依動作身份與本地訓練日期維持每天一筆最高 kg；更正可以降低錯誤值，正常再次完成則取當天最高。上次按所選日期之前最近一次完成查找，最高按全部有效新版資料重算。
- 動作改名及封存不改變身份，已存歷史名稱維持原樣；恢復後比較持續，不用名字當身份。
- UI 移除入口不等於刪除儲存資料。移除訓練總計時、共用 memo、容量圖表與新版 note 輸入時，仍須保留既有儲存內容及安全升級／還原能力。
- schemaVersion 2 與 release.config 的 dataVersion 2 對齊；保留原 key 及所有 retired 欄位，新增 completedEntries，既有 entries 不轉成完成。備份寫入失敗時不寫新版。瀏覽器中的本地備份會隨網站資料一起被清除，不能替代外部備份。
- 已將兩頁草圖接到正式 src/；對話中的 work/ 草圖仍是示範，沒有正式資料連線。更新快照支援舊四頁格式，將原 ISO 日期按本地時區轉回日期，避免跨日錯誤，並保留新頁的未完成重量、管理草稿、更正內容及折疊狀態。
- 不可把已開始寫新版資料的 App 直接回退到不認識 completedEntries 的四頁程式；回復須使用能保留 v2 欄位的相容修復版。來源備份只用於診斷／另行制定回復，不自動覆蓋現有新版紀錄。

外觀補充：App 與更新頁尾僅使用主題 surface 底色，不疊加點狀背景圖；外側背景與功能邏輯不變。
