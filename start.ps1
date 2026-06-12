# Audioguide — start everything
# Usage: Right-click → Run with PowerShell
#        OR: cd D:\Projects\audioguide && .\start.ps1

$caddy = "C:\Users\Ailab\AppData\Local\Microsoft\WinGet\Packages\CaddyServer.Caddy_Microsoft.Winget.Source_8wekyb3d8bbwe\caddy.exe"
$root  = $PSScriptRoot

# Kill any existing instances
Get-Process -Name caddy, node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1

Write-Host ""
Write-Host "  AI Audioguide" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────" -ForegroundColor DarkGray

# Backend
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$root\backend'; Write-Host 'BACKEND' -ForegroundColor Cyan; node src/index.js`"" -WindowStyle Normal

# Frontend
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$root\frontend'; Write-Host 'FRONTEND' -ForegroundColor Magenta; npm run dev`"" -WindowStyle Normal

Write-Host "  Starting backend + frontend..." -ForegroundColor Yellow
Start-Sleep 5

# Caddy
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$root'; Write-Host 'CADDY PROXY' -ForegroundColor Green; & '$caddy' run --config '$root\Caddyfile'`"" -WindowStyle Normal

Start-Sleep 2
Write-Host ""
Write-Host "  Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  PC browser  :  http://localhost:5173" -ForegroundColor White
Write-Host "  Phone (HTTPS): https://tarailab.tail1868ac.ts.net:8443" -ForegroundColor Cyan
Write-Host "  Health check : https://localhost:8443/health" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  First time on phone? Install the CA cert:" -ForegroundColor Yellow
Write-Host "    C:\Users\Ailab\AppData\Local\mkcert\rootCA.pem" -ForegroundColor White
Write-Host "    See docs\PHONE_SETUP.md for step-by-step instructions" -ForegroundColor DarkGray
Write-Host ""