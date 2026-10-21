# Workout Calendar

本輪本地功能：分類在前與類內筆畫排序、動作管理中的訓練組合、加入今天待做清單、App 內回報，以及休息結束橘色十秒提示。待做不算完成；逐項記錄重量才更新成績。操作與實際驗證見 [本輪驗收](docs/validation/2026-10-21-training-and-rest.md)，本地修改不代表已正式發布。

免登入、資料保存在個人裝置的健身紀錄 PWA。目前分支已接上兩頁簡單版面：每個動作每天記一次完成最高重量，對照上次及歷史最高；保留日曆、動作管理與休息倒數，舊紀錄只讀保留。尚未正式部署。

## 開始使用／開發

需要 Node.js 24；在 repo 根目錄執行：

```powershell
npm ci
npx playwright install chromium
npm run release -- --release 2026.10.20.2
npm run preview
```

開啟 `http://127.0.0.1:5173/workout_calendar/src/`。版本號是本地範例，正式發版須使用未用過的 ID。PowerShell 若阻擋 `npm.ps1`，改用 `npm.cmd`／`npx.cmd` 即可。

`release` 建置並檢查 `dist/`、執行升級測試，不會自動提交或部署。`preview` 只讀取已建置的產物，修改來源後需重新建置。手機實機與正式部署驗收尚未完成。

分項檢查：`npm run test:unit`（資料規則）、`npm run test:product`（產品操作）、`npm run test:update`（版本升級）。後兩者使用現有 dist/。本次功能及可親自操作的測試見 [重量紀錄驗收](docs/validation/2026-10-20-weight-records.md)。

## 去哪裡找

| 位置 | 用途 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 我們的合作方式 |
| [docs/](docs/README.md) | 產品規格、架構、決策、發版與驗收文件 |
| `src/` | App 畫面、功能與儲存；目前整理不改此目錄 |
| `tools/` | 建置、預覽、檢查及 UI 製圖工具 |
| `tests/` | 自動升級測試 |
| `.github/workflows/` | GitHub 檢查與手動發布流程 |
| `release.config.json` | 正式入口及部署設定 |

`dist/`、`.release-tests/`、`node_modules/` 與 UI 圖片是工具產物，不提交到 Git。用戶訓練紀錄存在瀏覽器，不在 repo；整理 repo 不會替它們備份。

正式入口維持 `https://zane82128.github.io/workout_calendar/src/`。發布前請依[發版 SOP](docs/release/sop.md)操作，不能把原始 `src/` 當成新流程的部署產物。
