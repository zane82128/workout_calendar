# UI 元件命名與標註圖

2026-10-22 層次調整：#app-navigation 為吸附分頁容器；#open-settings 打開 #settings-panel，內含 #theme-select、#update-panel 與 #feedback-panel。#update-shortcut 只有新版就緒時出現。UI maps 的共用標註改為設定入口，避免標註未開面板內的更新控制。

2026-10-22：「Exercise Select」的可見入口改為 #open-exercise-picker 按鈕，內部 #exercise-select 隱藏保留快照相容。分類由 .exercise-group 呈現，管理以 .exercise-actions 的 summary 展開操作，新增表單製圖需開啟 #add-exercise-panel。不再使用長選單作為紀錄頁的操作入口。

命名採 `Page > Section > Element`，既有元件名稱沿用，不因整理資料夾而改名。標註圖為可重新產生的工具產物，不是正式規格或用戶資料。`docs/ui_component_maps/` 只放這些圖片；設定與程式仍在 `tools/`。

### 舊版 Schedule 名稱對照（歷史參考）

以下為四頁版名稱，部分元件已移除，不代表本版仍存在。現行兩頁的標註與 selector 以 `tools/ui-map.config.json` 為準；仍存在的日期、動作、重量及休息元件沿用原名。

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


- 原圖命名：`*_raw.png`
- 標註圖命名：`*_annotated.png`
- 建議使用自動生成腳本，避免手動框選造成偏移
- 本版產生的畫面：
  - `docs/ui_component_maps/record_raw.png` -> `docs/ui_component_maps/record_annotated.png`
  - `docs/ui_component_maps/calendar_raw.png` -> `docs/ui_component_maps/calendar_annotated.png`
  - `docs/ui_component_maps/task_raw.png` -> `docs/ui_component_maps/task_annotated.png`
  - 舊產圖若仍留在本地不代表現行頁面，圖片由工具產生且不提交。
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
