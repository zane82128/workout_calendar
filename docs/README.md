# 文件導覽

先讀產品規格，再依工作需要深入。現行規則、下一版決定與歷史資料分開記錄。

| 想了解什麼 | 文件 |
| --- | --- |
| 現在有哪些功能、下一版要做什麼 | [產品規格](product/spec.md) |
| 資料放哪裡、程式如何分工 | [架構與資料流](architecture/overview.md) |
| 為什麼做這個選擇、哪些已確認 | [重要決策](decisions/README.md) |
| 如何更新、發布、安裝及回復 | [發版 SOP](release/sop.md) |
| 之前實際驗證過什麼 | [2026-10-19 本地驗收](validation/2026-10-19.md) |
| 這次 repo 整理的驗收 | [2026-10-20 repo 整理](validation/2026-10-20-repo.md) |
| 兩頁重量紀錄改版及試用步驟 | [2026-10-20 重量紀錄驗收](validation/2026-10-20-weight-records.md) |
| 如何稱呼 UI 元件、產生標註圖 | [UI 元件規範](architecture/ui-components.md) |
| 查閱過往開發脈絡 | [歷史開發日誌](archive/development-log.md) |

合作規則留在 repo 根目錄的 [AGENTS.md](../AGENTS.md)。`archive/` 僅供歷史參考，不作為現行需求或執行指令。

## 本次精簡

- `guide.md`：刪除。有效的未來想法已整理至產品規格，協作及 UI 規則移至專責文件；舊個人電腦路徑不再保留為操作指令。
- `execution_plan.md`：刪除。已完成的休息計時器計畫，現行規則、驗收與開發歷史已有對應說明。
- `github_pages_pwa_steps.md`：整合至發版 SOP 後刪除，避免維護兩份部署指令。
- 原 README 的 UI 命名與製圖規則移至 UI 元件文件；README 只保留簡介、啟動與文件入口。
- 開發日誌封存而不刪除，保留歷史描述；其中舊路徑及當時狀態不代表現在的檔案位置或發布狀態。
