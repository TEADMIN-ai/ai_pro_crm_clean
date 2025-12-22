Write-Host "Running AI Pro CRM Build Doctor..."

# 1. Fix UTF-8 encoding issues
$utf8Files = @(
  "src/app/dashboard/admin/users/page.tsx",
  "src/app/dashboard/analytics/page.tsx",
  "src/app/dashboard/deals/page.tsx",
  "src/app/dashboard/page.tsx"
)

foreach ($file in $utf8Files) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw
    Set-Content -Path $file -Value $content -Encoding UTF8
    Write-Host "Fixed encoding: $file"
  }
}

# 2. Fix invalid escaped fetch URLs
$apiFiles = @(
  "src/app/api/analytics/route.ts",
  "src/app/api/deals/route.ts",
  "src/app/api/deals/update/route.ts"
)

foreach ($file in $apiFiles) {
  if (Test-Path $file) {
    $text = Get-Content $file -Raw
    $text = $text -replace "\\\\/comm/propal\\\\", "/comm/propal"
    Set-Content -Path $file -Value $text -Encoding UTF8
    Write-Host "Fixed fetch URL: $file"
  }
}

# 3. Ensure Firestore db export exists
$firebaseConfig = "src/lib/firebase/config.ts"
if (Test-Path $firebaseConfig) {
  $cfg = Get-Content $firebaseConfig -Raw
  if ($cfg -notmatch "export const db") {
    Add-Content $firebaseConfig ""
    Add-Content $firebaseConfig "import { getFirestore } from 'firebase/firestore';"
    Add-Content $firebaseConfig "export const db = getFirestore(app);"
    Write-Host "Added Firestore db export"
  }
}

# 4. Clear Next.js cache
if (Test-Path ".next") {
  Remove-Item -Recurse -Force ".next"
  Write-Host "Cleared .next cache"
}

Write-Host ""
Write-Host "Doctor finished."
Write-Host "Next steps:"
Write-Host "git add ."
Write-Host "git commit -m `"fix: repair encoding, api routes, firestore db export`""
Write-Host "git push"
Write-Host "Redeploy on Vercel"