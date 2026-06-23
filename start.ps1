# Audioguide — start everything with auto-restart
# Usage: Right-click → Run with PowerShell  OR: .\start.ps1

$caddy = "C:\Users\Ailab\AppData\Local\Microsoft\WinGet\Packages\CaddyServer.Caddy_Microsoft.Winget.Source_8wekyb3d8bbwe\caddy.exe"
$root  = $PSScriptRoot

Write-Host ""
Write-Host "  AI Audioguide" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────" -ForegroundColor DarkGray

# Kill any existing instances
Get-Process -Name caddy, node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1

# Backend — restarts on crash
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\backend'; Write-Host 'BACKEND' -ForegroundColor Cyan; while (`$true) { node src/index.js; Write-Host 'Backend crashed, restarting in 3s...' -ForegroundColor Red; Start-Sleep 3 }"
) -WindowStyle Normal

# Frontend — restarts on crash
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\frontend'; Write-Host 'FRONTEND' -ForegroundColor Magenta; while (`$true) { npm run dev; Write-Host 'Frontend crashed, restarting in 3s...' -ForegroundColor Red; Start-Sleep 3 }"
) -WindowStyle Normal

Write-Host "  Starting backend + frontend..." -ForegroundColor Yellow
Start-Sleep 6

# Caddy — restarts on crash
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root'; Write-Host 'CADDY' -ForegroundColor Green; while (`$true) { & '$caddy' run --config '$root\Caddyfile'; Write-Host 'Caddy crashed, restarting in 3s...' -ForegroundColor Red; Start-Sleep 3 }"
) -WindowStyle Normal

Start-Sleep 2
Write-Host ""
Write-Host "  Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  PC browser  :  http://localhost:5173" -ForegroundColor White
Write-Host "  Phone (HTTPS): https://tarailab.tail1868ac.ts.net:8443" -ForegroundColor Cyan
Write-Host "  Health check : https://localhost:8443/health" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  All services auto-restart on crash." -ForegroundColor DarkGray
Write-Host "  Close the 3 console windows to stop everything." -ForegroundColor DarkGray
Write-Host ""
