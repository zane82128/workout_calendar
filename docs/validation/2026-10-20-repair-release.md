# 修復發布選項檢查

2026-10-20；僅流程與文件修改，沒有改 App。未提交、推送或部署。

靜態檢查確認：repair_release 預設 false；main 且（mobile_verified 或 repair_release）才建置；完整 npm run release 步驟、deploy 依賴 build、record 依賴 deploy 均保留。git diff --check 通過。環境沒有 PyYAML，未完成 YAML 解析器驗證；GitHub Actions 實際解析、執行與部署仍待提交後確認。此次未重跑 App 的完整測試，遠端發版時仍強制執行。

操作與部署後 Android 驗收見 docs/release/sop.md 第 7 節。不可把來源修改完成視為正式站已修復。
