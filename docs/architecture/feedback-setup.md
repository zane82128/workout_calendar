# 回報接收服務：Google Apps Script 最小驗證

狀態：2026-10-21 本地原型；沒有建立線上服務、沒有正式 App 回報入口，也未驗證 Google 跨站回應。使用者選擇小型免費方案、不收聯絡資料。既有 GitHub Pages 部署不變。

後續進度：使用者已自行部署並提供 /exec；隔離 Chromium 從 localhost 及正式 github.io origin 均收到可讀的成功與重試確認，見 [實測紀錄](../validation/2026-10-21-feedback-prototype.md)。私人表格列數待擁有者確認；正式 App 入口尚未整合。

## 你會使用什麼

- Google Apps Script：接收文字的小程式，以擁有者身份執行。
- 私人 Google 試算表：只有你能查看；不可設成公開或「知道連結即可查看」。
- App 未來提供主旨與內容，版本資訊送出前告知；不傳訓練資料、聯絡方式或附件。服務接收網路連線，不宣稱完全匿名。

Google 執行與帳號額度可能變更，超出時回報會失敗；不開啟付費服務或新增計費帳號。這是基本小型服務，不保證抵擋惡意大量請求。

## 一次性設定（需你登入 Google）

1. 開啟 https://script.google.com/ ，新增專案，名稱可用 Workout Calendar Feedback。
2. 將 repo 的 `services/feedback/Code.gs` 全部內容貼進編輯器的 Code.gs，儲存。
3. 上方函式選 `setupFeedback`，執行並檢閱 Google 權限，只授權你自己建立的程式。這個動作會建立一份「Workout Calendar 問題回報」試算表，並保存 ID 到指令碼屬性；執行記錄會顯示私人試算表網址。不要重複執行。
4. 開啟那份試算表，應有 Reports 工作表與五個欄位；保持私人，不改欄名／工作表名稱。不把這份表移交給回報者。
5. 部署 → 新增部署 → 網頁應用程式；執行身分選自己，存取權選「所有人」（允許未登入者）。這只開放接收程式，不公開試算表；程式沒有讀取回報清單的 API。若帳號政策沒有這個選項，先停在這裡處理，不要改成要求用戶授權。
6. 複製結尾為 `/exec` 的部署網址，不用 `/dev`。修改程式後須編輯部署並選新版本；只儲存編輯器不會更新已部署版本。

部署網址是公開入口，不是密碼；Google token、帳號 cookie 與憑證不能貼到 repo 或前端。此服務以你的試算表權限運作；停止服務可封存部署，資料表可保留。

## 最小連線驗收

在 repo 執行：

```powershell
node tools/feedback-preview.mjs
```

1. 電腦瀏覽器開啟 http://127.0.0.1:5174/ ，填 `/exec` 網址、按送出測試。固定測試文字不含訓練資料。
2. 必須看到服務回傳相符編號的保存確認，且私人試算表有一列相同編號，才算這次連線成功。
3. 再按一次送出，不換編號，表格不可多一列。
4. 斷網再送，應顯示無法確認成功，不顯示已送出。
5. 本地瀏覽器成功仍不等於 GitHub Pages 與 Android 成功；正式整合前，還須由實際 github.io origin 執行同一確認與錯誤流程。服務目前不在 App 的離線快取清單。

跨站回應若被瀏覽器阻擋，先記錄錯誤並調查，不得改成 `mode: no-cors`（無法讀到保存確認），也不以 iframe 載入完成當作成功。Google Content Service 會重新導向 googleusercontent.com，fetch 必須跟隨；本原型使用 text/plain JSON 避免不必要的 preflight，實際支援仍待驗證。

## 原型限制

- 主旨最多 80、內容 2000、版本 60 個 UTF-16 字元；這是原型邊界，正式 UI 顯示限制須同步。
- 每日最多接受 100 個新回報（UTC 換日），總表最多 5000 個，超出拒絕；失敗寫入可能消耗當日名額。沒有 IP 蒐集或完整個人限流；公開呼叫者可能耗盡額度。
- 相同回報編號與內容重試只確認、不新增；相同編號不同內容拒絕。逾時可能已寫入，需用同一編號重試。
- 寫入失敗回傳一般錯誤，不暴露文字、帳號、堆疊。以零寬字元前綴處理公式起始符號，避免把回報文字執行成試算表公式。
- 不定期自動刪除資料；管理者可手動處理。刪除已收到的列後，該回報編號的去重紀錄也不復存在。
- 正式 App 表單、草稿保存、送出冷卻、更新前草稿保護與管理狀態尚未接上；本原型不是完成的回報功能。

官方依據：[Web Apps](https://developers.google.com/apps-script/guides/web)、[Content Service](https://developers.google.com/apps-script/guides/content)、[額度](https://developers.google.com/apps-script/guides/services/quotas)。
