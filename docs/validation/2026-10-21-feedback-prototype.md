# 回報接收原型驗證

2026-10-21。本次只新增獨立服務原型、開發測試頁與設定文件，未改正式 src/、未部署或送出真實回報。工作目錄原先已有 tests/product.test.mjs 的修改，本次未變更它。

`node --test tests/feedback-service.test.mjs`：5 項通過，使用本地 Google API 替身，涵蓋保存後確認、同編號去重／內容衝突、非法／過長／未知欄位拒絕、試算表公式注入保護、寫入失敗與未設定不回成功、當日上限及鎖釋放。這不是 Apps Script 線上執行結果。

尚待：使用者登入 Google 並部署，取得 /exec；實際寫入私人試算表與跨站可讀回應；從正式 origin 與 Android 驗收；App 表單及草稿整合；免費額度與帳號存取政策核對。不得把本地單元測試當成服務已可用。

## 使用者部署後的實際連線

使用者提供 /exec 網址後，以未登入 Google 的隔離 Chromium 測試：GET 回 service=workout-feedback、protocol=1；從 localhost 及真實 `https://zane82128.github.io/workout_calendar/src/` 頁面各 POST 兩次，同一固定測試內容與 UUID。四次均為 HTTP 200，瀏覽器可讀到 ok=true 且編號相符，沒有使用 no-cors，也未修改公開網站。測試編號 `d568f671-7543-4514-a342-9d6eed19fa92`，主旨 `[TEST] 回報服務連線驗證`。

這確認跨站可讀保存確認與同編號重試的服務回應；私人試算表沒有存取權，實際列數及內容仍需使用者查看，不能宣稱已直接查表。Android 實機與正式 App 表單整合仍待驗證。詳細結果在忽略提交的 .release-tests/feedback-live-results.json；測試不含用戶訓練或聯絡資料。
