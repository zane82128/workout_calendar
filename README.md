# Workout Calendar

一個使用原生 HTML/CSS/JavaScript 打造的健身紀錄日曆原型。以「訓練清單＋每日訓練記錄」為核心，所有資料皆儲存在使用者瀏覽器的 `localStorage`，不依賴雲端資料庫。

## 功能特色

- **訓練清單（Task List）**：新增/管理訓練動作，作為紀錄的選項來源。
- **Schedule 面板**：類似行事曆 Schedule，但移除時間軸，改成純訓練動作的 Event Block。
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
  - `exercises`: `[ { id, name, createdAt } ]`
  - `entries`: `[ { id, dateKey, exerciseId, exerciseName, weight, unit, reps, sets, createdAt } ]`
  - `selectedDate`: 使用者最後瀏覽的日期

## 文件

- 開發日誌：`develop_log.md`
- 需求說明：`guide.md`
