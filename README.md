# Workout Calendar

一個使用原生 HTML/CSS/JavaScript 打造的健身紀錄日曆原型。以「訓練清單＋每日訓練記錄」為核心，所有資料皆儲存在使用者瀏覽器的 `localStorage`，不依賴雲端資料庫。

## 功能特色

- **訓練清單（Task List）**：新增/管理訓練動作，作為紀錄的選項來源。
- **大分類管理**：支援 `胸/背/腿/肩膀/手臂/臀/有氧`，可在 Tasks 指定分類。
- **Schedule 面板**：類似行事曆 Schedule，但移除時間軸，改成純訓練動作的 Event Block。
- **分類篩選 + 搜尋**：Schedule 可先用分類篩選，再用關鍵字搜尋動作。
- **Add Entry 簡化**：Schedule 新增紀錄時只需選動作，詳細數值改在卡片內調整。
- **Event Block 可編輯**：每筆紀錄可調整日期、重量、次數、組數，並可直接複製整筆 detail。
- **備註欄位**：每筆 Workout Entry Card 皆可填寫 note（例如休息秒數、當下狀態）。
- **Schedule 日期保護**：每次進入 Schedule 會自動回到今天，降低記錄到錯日期的風險。
- **Schedule Session Timer**：Schedule 頂部新增 timer bar，顯示本次訓練經過時間。
- **組間休息倒數 Timer**：Session Timer 下方新增 Rest Timer，可設定 `mins/secs` 並進行倒數。
- **休息結束提醒鈴聲**：Rest Timer 倒數到 0 時觸發鈴聲並持續 1 分鐘（使用 Web Audio API，走瀏覽器音訊輸出，可透過耳機播放）；可按 `Pause` 提前關閉鈴聲。
- **Record Memo**：`Setting for my record` 提供獨立備忘錄並持久化儲存。
- **Add Entry 提示**：新增訓練後會顯示「已新增xxx」小視窗。
- **Progress 折線圖**：可選特定動作，依「日/月」統計總容量（重量*次數*組數）並顯示趨勢。
- **重量單位切換**：提供 `kg / lb`，當使用 `lb` 時同步顯示換算後的 `kg`。
- **本地端儲存**：資料全存 `localStorage`，不需要登入或雲端。
- **日曆高亮**：Home 月曆中有訓練紀錄的日期會整塊以橘色標示，並提供有/無紀錄圖例。
- **Home 四週視窗**：Month Grid 固定顯示「前兩週 + 本週 + 下週」共四週。

## 專案結構

```
workout_calendar/
  src/
    index.html
    styles.css
    main.js
    preset-exercises.js
    manifest.json
    sw.js
    icons/
  README.md
  develop_log.md
  guide.md
```

## 介面命名規範

- 命名格式：`Page > Section > Element`
- 例如：`Schedule Page > Add Entry Form > Exercise Search Input`

### Schedule Page（建議術語）

- `Schedule Page`
- `Schedule Header`
- `Header Date Picker`
- `Add Entry Form`
- `Exercise Category Filter`
- `Exercise Search Input`
- `Exercise Select`
- `Add Entry Button`
- `Record Settings Memo`
- `Session Timer Bar`
- `Session Timer Start Button`
- `Session Timer Pause Button`
- `Rest Timer`
- `Rest Timer Minutes Input`
- `Rest Timer Seconds Input`
- `Rest Timer Start Button`
- `Rest Timer Pause Button`
- `Add Entry Toast`
- `Workout Entry List`
- `Workout Entry Card`
- `Entry Title`
- `Entry Category Label`
- `Entry Copy Button`
- `Entry Delete Button`
- `Entry Date Input`
- `Entry Weight Input`
- `Entry Unit Select`
- `Entry Reps Input`
- `Entry Sets Input`
- `Entry Note Input`

## 開發 / 部署

1. 本地預覽：
   ```bash
   cd src
   python -m http.server 5173
   ```
   此方式為來源預覽，不啟用 Service Worker。更新功能請使用建置預覽：
   ```bash
   npm ci
   npx playwright install chromium
   npm run release -- --release 2026.10.19.1
   npm run preview
   ```
   開啟 `http://127.0.0.1:5173/workout_calendar/src/`。版本 ID 為範例，正式發版須換成未使用的日期與序號。
2. 部署到 GitHub Pages：
   - 正式產物為 `dist/`，保留 App 的 `/workout_calendar/src/` 入口。
   - 一般 push 只檢查；在 Actions 手動執行 `Release PWA` 才部署。
   - 首次須將 Pages 的來源改為 GitHub Actions，並完成手機升級驗收。
   - 完整流程見 [發版 SOP](docs/release-sop.md) 與 [部署步驟](github_pages_pwa_steps.md)。

## 本地端資料格式

- `localStorage` key: `workoutCalendar.v1`
- 結構摘要：
  - `exercises`: `[ { id, name, category, createdAt } ]`
  - `entries`: `[ { id, dateKey, exerciseId, exerciseName, exerciseCategory, weight, unit, reps, sets, note, createdAt } ]`
  - `presetVersionApplied`: 已套用的預設動作版本
  - `recordMemo`: Schedule 的 `Setting for my record` 內容
  - `scheduleSessionStartedAt`: Schedule timer 的 session 起始時間
  - `restTimerMinutes`: Rest Timer 設定分鐘數
  - `restTimerSeconds`: Rest Timer 設定秒數
  - `restTimerRemainingSeconds`: Rest Timer 目前剩餘秒數
  - `restTimerRunning`: Rest Timer 是否正在倒數
  - `restTimerStartedAt`: Rest Timer 當前倒數起始時間
  - `selectedDate`: 使用者最後瀏覽的日期

## 預設動作清單

- 檔案：`src/preset-exercises.js`
- 修改 `PRESET_EXERCISES` 可調整預先載入的訓練動作與分類（`{ name, category }`）。
- 若你改了清單，請同步調整 `PRESET_VERSION`，系統才會把新版本清單套用到本地端。

## 文件

- PWA 更新與發版規格：[docs/release-sop.md](docs/release-sop.md)（本地流程已建立，手機與正式環境待驗收）
- 本地驗收紀錄：[docs/local-validation.md](docs/local-validation.md)
- 開發日誌：`develop_log.md`
- 需求說明：`guide.md`
- UI 元件標註圖：`docs/ui_component_maps/`

## UI 標註圖規範

- 原圖命名：`*_raw.png`
- 標註圖命名：`*_annotated.png`
- 建議使用自動生成腳本，避免手動框選造成偏移
- 已建立頁面：
  - `docs/ui_component_maps/home_raw.png` -> `docs/ui_component_maps/home_annotated.png`
  - `docs/ui_component_maps/task_raw.png` -> `docs/ui_component_maps/task_annotated.png`
  - `docs/ui_component_maps/schedule_raw.png` -> `docs/ui_component_maps/schedule_annotated.png`
  - `docs/ui_component_maps/progress_raw.png` -> `docs/ui_component_maps/progress_annotated.png`
- 自動生成方式：
  - `npm install`
  - `npx playwright install chromium`
  - `npm run ui:maps`
- 設定檔：
  - `tools/ui-map.config.json`（label 與 selector mapping）
  - `tools/generate-ui-maps.mjs`（固定 viewport、注入標註、輸出圖片）
- 命名原則：
  - 舊元件沿用既有名稱（避免跨版本混亂）
  - 新元件採 `Page > Section > Element` 的邏輯命名
