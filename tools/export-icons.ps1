# Deterministic size exports; does not alter the approved master artwork.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot 'designs/app-icon/shield-master.png'
$outputPath = Join-Path $repoRoot 'src/icons'
$sourceImage = [Drawing.Image]::FromFile($sourcePath)
try {
  foreach ($size in @(32, 180, 192, 512)) {
    $bitmap = New-Object Drawing.Bitmap($size, $size, ([Drawing.Imaging.PixelFormat]::Format24bppRgb))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#171e29'))
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
      $bitmap.Save((Join-Path $outputPath "shield-v1-$size.png"), [Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  }
} finally { $sourceImage.Dispose() }
Write-Output 'Exported shield-v1 icons: 32, 180, 192, 512px'
