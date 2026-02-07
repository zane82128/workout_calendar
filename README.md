# Workout Calendar

一個使用原生 HTML/CSS/JavaScript 打造的健身紀錄日曆原型。以「訓練清單＋每日訓練記錄」為核心，所有資料皆儲存在使用者瀏覽器的 `localStorage`，不依賴雲端資料庫。

## 功能特色

- **訓練清單（Task List）**：新增/管理訓練動作，作為紀錄的選項來源。
- **大分類管理**：支援 `胸/背/腿/肩膀/手臂/臀/有氧`，可在 Tasks 指定分類。
- **Schedule 面板**：類似行事曆 Schedule，但移除時間軸，改成純訓練動作的 Event Block。
- **分類篩選 + 搜尋**：Schedule 可先用分類篩選，再用關鍵字搜尋動作。
- **Event Block 可編輯**：每筆紀錄包含重量、次數、組數欄位，即時修改並同步到本地端。
- **重量單位切換**：提供 `kg / lb`，當使用 `lb` 時同步顯示換算後的 `kg`。
- **本地端儲存**：資料全存 `localStorage`，不需要登入或雲端。
- **日曆高亮**：Home 月曆中有訓練紀錄的日期會以綠色標示，並顯示當日筆數。

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

## 開發 / 部署

1. 本地預覽：
   ```bash
   cd /home/zane82128/personal/workout_calendar/src
   python -m http.server 5173
   ```
2. 部署到 GitHub Pages：
   - 直接將 `src/` 內容作為靜態站點來源即可。

## 本地端資料格式

- `localStorage` key: `workoutCalendar.v1`
- 結構摘要：
  - `exercises`: `[ { id, name, category, createdAt } ]`
  - `entries`: `[ { id, dateKey, exerciseId, exerciseName, exerciseCategory, weight, unit, reps, sets, createdAt } ]`
  - `presetVersionApplied`: 已套用的預設動作版本
  - `selectedDate`: 使用者最後瀏覽的日期

## 預設動作清單

- 檔案：`src/preset-exercises.js`
- 修改 `PRESET_EXERCISES` 可調整預先載入的訓練動作與分類（`{ name, category }`）。
- 若你改了清單，請同步調整 `PRESET_VERSION`，系統才會把新版本清單套用到本地端。

## 文件

- 開發日誌：`develop_log.md`
- 需求說明：`guide.md`
