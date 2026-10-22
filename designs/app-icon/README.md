# 力量徽章圖示

2026-10-22 使用者選擇 C 款並同意製作正式圖示。使用內建 imagegen，參考三款比較草圖中的 C，生成 `shield-master.png`（1254 × 1254、不透明 PNG）。

生成方向：單一置中的金色像素盾牌，內含米白槓鈴，深藍背景；對稱、無文字、無展示框；主體保留圓形裁切空間。此圖為 AI 生成素材，非手工逐像素繪製。

執行 `powershell -NoProfile -File tools/export-icons.ps1` 可從原稿輸出網站 32、Apple 180、PWA 192 與 512 像素版本。原稿不隨網站部署。

512 版兼作 maskable 圖示。原稿金色／米白主體距中心最遠約為圖寬的 36.7%，小於 [Web App Manifest 安全圓半徑 40%](https://www.w3.org/TR/appmanifest/#icon-masks)。圓形與小尺寸預覽另經人工檢視。
