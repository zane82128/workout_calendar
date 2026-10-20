# UI 元件命名與標註圖

命名採 `Page > Section > Element`，既有元件名稱沿用，不因整理資料夾而改名。標註圖為可重新產生的工具產物，不是正式規格或用戶資料。`docs/ui_component_maps/` 只放這些圖片；設定與程式仍在 `tools/`。

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
