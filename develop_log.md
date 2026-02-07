# Workout Calendar

一個使用原生 HTML/CSS/JavaScript 打造的健身紀錄日曆原型。保留行事曆的月份選取體驗，並以「訓練清單＋每日訓練記錄」為核心，所有資料皆儲存在使用者瀏覽器的 `localStorage`，不依賴雲端資料庫。

## 功能特色

- **訓練清單（Task List）**：用來新增/管理訓練動作，成為日後紀錄的選項來源。
- **Schedule 面板**：類似原行事曆的 Schedule，但移除時間軸，改成純訓練動作的 Event Block。
- **Event Block 可編輯**：每個訓練動作卡片內含重量、次數、組數欄位，即時修改並同步到本地端。
- **重量單位切換**：提供 `kg / lb` 選擇，當使用 `lb` 時同步顯示換算後的 `kg`。
- **本地端儲存**：所有紀錄使用 `localStorage` 存取，不需要登入或雲端。
- **日曆高亮**：Home 月曆中有訓練紀錄的日期會以綠色背景標示，並顯示當日的訓練筆數。
- **GitHub Pages 友善**：純靜態檔案，可直接佈署在 GitHub Pages。

## 專案結構

```
workout_calendar/
  src/
    index.html       # 主頁面與三個面板（Home/Tasks/Schedule）
    styles.css       # 版面與卡片樣式
    main.js          # 日曆與訓練資料的渲染與操作
    manifest.json    # PWA 設定
    sw.js            # Service Worker（快取）
    icons/
      calendar-icon.svg
  develop_log.md
  guide.md
```

## 元件 / 名詞定義

| 名稱 | 說明 |
| --- | --- |
| **Training List** | Tasks 分頁，新增訓練動作的清單。 |
| **Schedule Panel** | 顯示選定日期的訓練記錄（無時間軸）。 |
| **Workout Card** | 單筆訓練記錄卡片，包含重量/次數/組數欄位。 |
| **Workout Highlight** | Home 月曆中有訓練的日期，顯示綠色標示與次數。 |

## 本地端資料格式

- `localStorage` key: `workoutCalendar.v1`
- 結構摘要：
  - `exercises`: `[ { id, name, createdAt } ]`
  - `entries`: `[ { id, dateKey, exerciseId, exerciseName, weight, unit, reps, sets, createdAt } ]`
  - `selectedDate`: 使用者最後瀏覽的日期

## 開發 / 部署

1. 本地預覽：
   ```bash
   cd /home/zane82128/personal/workout_calendar/src
   python -m http.server 5173
   ```
2. 部署到 GitHub Pages：
   - 直接將 `src/` 內容作為靜態站點來源即可。

## 我做了哪些修改

- 新增 `workout_calendar/src` 結構，參考原 `calendar` 專案的 UI 排版。
- 移除登入與雲端資料流程，改為全 `localStorage` 儲存。
- 調整 Schedule 面板為訓練動作卡片，不使用時間軸。
- Tasks 面板改為訓練動作清單，可新增/刪除。
- Home 月曆加上「有訓練日期」的綠色標示與當日數量提示。

## 問題 / 可延伸方向

1. 需要支援「編輯訓練動作名稱」或「分類（胸/腿/背）」嗎？
2. 是否要新增「每筆訓練可填寫備註」欄位？
3. 你希望在 Home 月曆上顯示更詳細的摘要（例如總組數或總重量）嗎？
