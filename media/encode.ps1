$ErrorActionPreference = "Stop"
$ffmpeg = "C:\Users\garyf\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe"
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root "media\ladder"
$nul = "NUL"
Set-Location $root

function Encode-H264 {
  param($src, $dest, $vf, $bitrate)
  $log = Join-Path $out ([IO.Path]::GetFileNameWithoutExtension($dest) + "-pass")
  $buf = if ($bitrate -match '^(\d+)') { ([int]$Matches[1] * 2).ToString() + "k" } else { "8000k" }
  $common = @("-an", "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "medium", "-b:v", $bitrate, "-maxrate", $bitrate, "-bufsize", $buf, "-g", "48", "-keyint_min", "48", "-sc_threshold", "0")
  if ($vf) { $common = @("-vf", $vf) + $common }
  Write-Host "H264 pass1 $dest"
  & $ffmpeg -y -i $src @common -pass 1 -passlogfile $log -f mp4 $nul
  if ($LASTEXITCODE -ne 0) { throw "pass1 failed $dest" }
  Write-Host "H264 pass2 $dest"
  & $ffmpeg -y -i $src @common -movflags +faststart -pass 2 -passlogfile $log $dest
  if ($LASTEXITCODE -ne 0) { throw "pass2 failed $dest" }
  Remove-Item "$log*" -ErrorAction SilentlyContinue
}

function Encode-VP9 {
  param($src, $dest, $vf, $bitrate)
  $log = Join-Path $out ([IO.Path]::GetFileNameWithoutExtension($dest) + "-vpx")
  $common = @("-an", "-c:v", "libvpx-vp9", "-b:v", $bitrate, "-pix_fmt", "yuv420p", "-g", "48", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-tile-columns", "2")
  if ($vf) { $common = @("-vf", $vf) + $common }
  Write-Host "VP9 pass1 $dest"
  & $ffmpeg -y -i $src @common -pass 1 -passlogfile $log -f null $nul
  if ($LASTEXITCODE -ne 0) { throw "vp9 pass1 failed $dest" }
  Write-Host "VP9 pass2 $dest"
  & $ffmpeg -y -i $src @common -pass 2 -passlogfile $log $dest
  if ($LASTEXITCODE -ne 0) { throw "vp9 pass2 failed $dest" }
  Remove-Item "$log*" -ErrorAction SilentlyContinue
}

# Home desktop 4K master -> 1080 / 720
Encode-H264 "bond_hero_desktop.mp4" "$out\bond_hero_d.1080.h264.v1.mp4" "scale=1920:1080:flags=lanczos" "6000k"
Encode-H264 "bond_hero_desktop.mp4" "$out\bond_hero_d.720.h264.v1.mp4" "scale=1280:720:flags=lanczos" "3000k"
Encode-VP9  "bond_hero_desktop.mp4" "$out\bond_hero_d.1080.vp9.v1.webm" "scale=1920:1080:flags=lanczos" "4000k"

# Home mobile 1080x1920
Encode-H264 "bond_hero_mobile.mp4" "$out\bond_hero_m.1080.h264.v1.mp4" $null "4500k"
Encode-VP9  "bond_hero_mobile.mp4" "$out\bond_hero_m.1080.vp9.v1.webm" $null "3500k"

# SKU 16:9 (already ~720p; do not upscale)
Encode-H264 "Dialed_waves_16x9.mp4" "$out\dialed_w.720.h264.v1.mp4" $null "2800k"
Encode-VP9  "Dialed_waves_16x9.mp4" "$out\dialed_w.720.vp9.v1.webm" $null "2200k"
Encode-H264 "Peak_Fire_16x9.mp4" "$out\peak_w.720.h264.v1.mp4" $null "2800k"
Encode-VP9  "Peak_Fire_16x9.mp4" "$out\peak_w.720.vp9.v1.webm" $null "2200k"
Encode-H264 "Unwind_Night_Sky_2_16x9.mp4" "$out\unwind_w.720.h264.v1.mp4" $null "2800k"
Encode-VP9  "Unwind_Night_Sky_2_16x9.mp4" "$out\unwind_w.720.vp9.v1.webm" $null "2200k"

# SKU 9:16
Encode-H264 "Dialed_waves_9x16.mp4" "$out\dialed_n.720.h264.v1.mp4" $null "3000k"
Encode-VP9  "Dialed_waves_9x16.mp4" "$out\dialed_n.720.vp9.v1.webm" $null "2400k"
Encode-H264 "Peak_Fire_9x16.mp4" "$out\peak_n.720.h264.v1.mp4" $null "3000k"
Encode-VP9  "Peak_Fire_9x16.mp4" "$out\peak_n.720.vp9.v1.webm" $null "2400k"
Encode-H264 "Unwind_Night_Sky_2_9x16.mp4" "$out\unwind_n.720.h264.v1.mp4" $null "2500k"
Encode-VP9  "Unwind_Night_Sky_2_9x16.mp4" "$out\unwind_n.720.vp9.v1.webm" $null "2000k"

# Promo 3:4
Encode-H264 "Dialed_promo_video_3x4.mp4" "$out\dialed_p.3x4.h264.v1.mp4" $null "2500k"
Encode-VP9  "Dialed_promo_video_3x4.mp4" "$out\dialed_p.3x4.vp9.v1.webm" $null "2000k"
Encode-H264 "Peak_promo_video_3x4.mp4" "$out\peak_p.3x4.h264.v1.mp4" $null "2500k"
Encode-VP9  "Peak_promo_video_3x4.mp4" "$out\peak_p.3x4.vp9.v1.webm" $null "2000k"
Encode-H264 "Unwind_promo_video_3x4.mp4" "$out\unwind_p.3x4.h264.v1.mp4" $null "2000k"
Encode-VP9  "Unwind_promo_video_3x4.mp4" "$out\unwind_p.3x4.vp9.v1.webm" $null "1600k"

Write-Host "ENCODE DONE"
