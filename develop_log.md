# Workout Calendar

一個使用原生 HTML/CSS/JavaScript 打造的健身紀錄日曆原型。保留行事曆的月份選取體驗，並以「訓練清單＋每日訓練記錄」為核心，所有資料皆儲存在使用者瀏覽器的 `localStorage`，不依賴雲端資料庫。

## 功能特色

- **訓練清單（Task List）**：用來新增/管理訓練動作，成為日後紀錄的選項來源。
- **大分類管理**：支援 `胸/背/腿/肩膀/手臂/臀/有氧`，方便快速篩選動作。
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
    preset-exercises.js # 預設訓練動作清單（可直接修改）
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
  - `exercises`: `[ { id, name, category, createdAt } ]`
  - `entries`: `[ { id, dateKey, exerciseId, exerciseName, exerciseCategory, weight, unit, reps, sets, createdAt } ]`
  - `presetVersionApplied`: 已套用的預設動作版本
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
- Tasks 面板改為訓練動作清單，可新增/刪除/編輯名稱。
- Tasks 與 Schedule 都可編輯動作名稱，並同步更新歷史訓練紀錄。
- Schedule 的 Exercise 區塊新增關鍵字搜尋。
- 新增大分類：`胸/背/腿/肩膀/手臂/臀/有氧`。
- Tasks 新增動作時可指定分類，編輯時可修改分類。
- Schedule 新增分類篩選（可搭配關鍵字搜尋）。
- Workout Card 顯示動作分類。
- Home 月曆加上「有訓練日期」的綠色標示與當日數量提示。
- 新增 `src/preset-exercises.js`，預設訓練動作可集中維護。
- 預設動作改為 `{ name, category }` 結構，並以 `PRESET_VERSION` 控制本地端套用版本。
- 既有本地資料若缺分類，會在載入時自動補分類（優先用名稱對照預設分類）。

## 問題 / 可延伸方向

1. 是否要在 Tasks 加入「依分類分組顯示」或「分類摺疊」？
2. 是否要支援每筆訓練紀錄的備註（例如 RPE、感受、疼痛紀錄）？
3. 是否要在 Home 月曆顯示每日摘要（總組數、總次數、總訓練量）？
4. 是否要加入資料匯出/匯入（JSON）避免清除瀏覽器資料後遺失？
