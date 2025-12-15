# 🚀 Torque Empire AI Pro CRM - Clean & Start Script
# Location: C:\Users\user\Desktop\ai_pro_crm\start_clean.ps1
# Use: Right-click → "Run with PowerShell"

Write-Host "`n⚡ Starting Torque Empire AI Pro CRM maintenance cycle...`n" -ForegroundColor Cyan

# 1️⃣ Stop any existing Node.js processes
Write-Host "🔧 Killing Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# 2️⃣ Clean cache folders
Write-Host "🧹 Cleaning old build caches..." -ForegroundColor Yellow
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }

# 3️⃣ Ensure npm cache clean
Write-Host "🧼 Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force

# 4️⃣ Reinstall dependencies
Write-Host "📦 Reinstalling project dependencies..." -ForegroundColor Yellow
npm install

# 5️⃣ Optional audit fix (uncomment next line if you want auto-fix on every run)
# npm audit fix --force

# 6️⃣ Remove stray global lockfile if found
$rootLock = "C:\Users\user\package-lock.json"
if (Test-Path $rootLock) {
    Write-Host "🗑️ Removing stray root lockfile..." -ForegroundColor Yellow
    Remove-Item -Force $rootLock
}

# 7️⃣ Launch the development server
Write-Host "`n🖥️  Launching Next.js dev environment..." -ForegroundColor Cyan
npm run dev