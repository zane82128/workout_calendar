# GitHub Pages 變成手機 App（PWA）步驟

這份文件整理了把 `workout_calendar` 部署到 GitHub Pages，並在手機上安裝成 App 的流程。

## 1. 確認 PWA 必要檔案

專案 `src/` 內至少要有：

- `index.html`
- `manifest.json`
- `sw.js`
- `icons/calendar-icon.svg`（或其他 icon）

`index.html` 需包含：

```html
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="#0f172a" />
```

`main.js` 需註冊 Service Worker：

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
```

## 2. 推送到 GitHub

在專案根目錄執行：

```bash
git add .
git commit -m "your commit message"
git push
```

## 3. 設定 GitHub Pages

1. 打開 GitHub Repo：`https://github.com/zane82128/workout_calendar`
2. 進入 `Settings` -> `Pages`
3. `Build and deployment` 選：`Deploy from a branch`
4. Branch 選：`main`
5. Folder 選：`/root`
6. 儲存後等待部署完成

部署成功後，網址通常是：

- `https://zane82128.github.io/workout_calendar/`
- 或你的目前路徑：`https://zane82128.github.io/workout_calendar/src/`

## 4. 手機安裝

### Android (Chrome)

1. 用 Chrome 開啟 Pages 網址
2. 點選 `Install app` 或 `Add to Home screen`
3. 安裝後主畫面會出現 App 圖示

### iPhone (Safari)

1. 用 Safari 開啟 Pages 網址
2. 點 `分享` 按鈕
3. 選 `加入主畫面`

## 5. 常見問題：部署完成但畫面沒更新

通常是 Service Worker 快取造成。

### 快速排查

1. 手機或桌面瀏覽器強制重新整理
2. 清除網站資料（Site data）
3. 解除註冊 Service Worker 後重開

### 建議做法（每次發版）

1. 在 `sw.js` 更新 `CACHE_NAME` 版本（例如 `workout-calendar-pwa-v2`）
2. 靜態資源加版本參數（例如 `main.js?v=20260208`）

## 6. 建議驗收清單

- 網站能正常在 GitHub Pages 開啟
- 瀏覽器可看到 `manifest.json` 被載入
- Service Worker 註冊成功
- 手機可 `Add to Home screen`
- 安裝後開啟圖示可直接進入 App
- 更新版本後可看到新 UI（不被舊快取卡住）
