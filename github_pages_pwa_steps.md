# GitHub Pages PWA 發版與手機安裝

更新規格與完整檢查表：[docs/release-sop.md](docs/release-sop.md)。目前本地流程已建立，尚未執行正式部署或手機實機驗收。

## 首次設定

1. 安裝 Node.js 24，在 repo 根目錄執行 `npm ci` 與 `npx playwright install chromium`。
2. 確認 `release.config.json`。App 入口維持 `https://zane82128.github.io/workout_calendar/src/`；worker 維持該目錄的 `sw.js`。
3. 在 GitHub repo 的 Settings → Pages → Build and deployment，將 Source 設為 GitHub Actions。此帳號設定尚未由本次實作修改。
4. 確認 Actions 可執行，`github-pages` environment 允許 main 部署。若有保護規則，按該規則完成審核。
5. 將程式提交並 push 到 main；一般 CI 只檢查，不部署。

## 本地檢查與預覽

```powershell
npm run release -- --release 2026.10.19.1
npm run preview
```

版本為範例，正式發版請依 Asia/Taipei 日期與當日序號指定未使用 ID。

預覽網址：`http://127.0.0.1:5173/workout_calendar/src/`。PowerShell 如阻擋 npm.ps1，可使用 `npm.cmd`／`npx.cmd`。

`release` 依序建置、檢查現有產物、執行瀏覽器升級測試，不自動 commit、push 或部署。結果在 `.release-tests/results.json`，部署產物在 `dist/`。本地未提交內容會標記 sourceDirty，正式 CI 拒絕此狀態。

使用保留舊版安裝與資料的 Android Chrome、iOS Safari PWA 驗證升級。只測新安裝不足以確認更新正常。

## 正式發版

1. 確認已驗證 commit 位於 main，工作目錄乾淨，手機候選版本驗證完成。
2. 在 GitHub Actions 選擇 `Release PWA` → Run workflow，選 main，輸入 release ID，勾選手機驗證完成。
3. CI 執行相同建置與測試，保存產物，再部署同一份 Pages artifact；不重新建置。正式部署序列執行，部署前拒絕已落後 main 的 commit。
4. 確認 build、deploy、record 三個工作成功。部署後建立 `pwa-<ID>` tag，對應來源 commit；artifact 保留 90 天。
5. 正式網址檢查顯示版本、舊 PWA 更新提示、資料與計時保留、離線開啟，完成 SOP 的部署後驗收。

必須上傳整個 `dist/`，不能將 `dist/src/` 改為網站根目錄，否則會改變既有用戶的入口與 scope。

## 用戶如何更新

App 開啟、回到前景或恢復網路時檢查更新，自動檢查至少相隔 5 分鐘；也能按「檢查更新」。完整新版準備完成後顯示「立即更新／稍後」。選擇更新會保存狀態、協調其他頁面再重新載入。

首次從既有舊版升級時，舊程式沒有提示機制，可能需要關閉所有同站 PWA／分頁再開啟。後續版本由 App 提供更新入口。

離線或下載失敗會保留目前版本，不保證離線用戶立即更新。若其他頁面有草稿或計時，先完成並關閉那些頁面再更新。

不要為了更新而清除網站資料；訓練紀錄存在 localStorage，清除網站資料會一起刪除紀錄。也不要把手動更改快取名稱／JS 查詢參數當作完整發版流程。

## 手機安裝

- Android Chrome：開啟正式 App 網址，選擇「安裝應用程式」或「加到主畫面」。
- iPhone Safari：開啟同一網址，選擇分享 → 加入主畫面。

## 回復

使用已知穩定且相容目前資料格式的程式碼，以新 release ID 走相同檢查及部署流程。不要單純重用舊版本號；若資料格式不相容，先提供相容修復版。記錄問題版本、修復版本、commit 與驗收結果。
