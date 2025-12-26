# ================================
# AI Pro CRM – Build Doctor (Safe)
# ================================

Write-Host "🩺 Running Build Doctor..." -ForegroundColor Cyan

# 1. Ensure tsconfig.json excludes archived/broken folders
$tsconfig = "tsconfig.json"
if (Test-Path $tsconfig) {
  $json = Get-Content $tsconfig -Raw | ConvertFrom-Json

  if (-not $json.exclude) {
    $json | Add-Member -MemberType NoteProperty -Name exclude -Value @()
  }

  $requiredExcludes = @(
    "_archive_app__broken",
    "src/app__broken",
    ".next",
    "node_modules"
  )

  foreach ($e in $requiredExcludes) {
    if ($json.exclude -notcontains $e) {
      $json.exclude += $e
    }
  }

  $json | ConvertTo-Json -Depth 10 | Set-Content $tsconfig -Encoding UTF8
  Write-Host "✓ tsconfig.json updated" -ForegroundColor Green
}

# 2. Fix invalid escaped API paths
Get-ChildItem src -Recurse -Include route.ts,route.tsx | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  $fixed = $content -replace '\\\\/comm\\/propal\\\\', "'/comm/propal'"

  if ($content -ne $fixed) {
    Set-Content $_.FullName $fixed -Encoding UTF8
    Write-Host "✓ Fixed API path in $($_.FullName)" -ForegroundColor Green
  }
}

# 3. Ensure Firebase exports db
$firebaseConfig = "src/lib/firebase/config.ts"
if (Test-Path $firebaseConfig) {
  $content = Get-Content $firebaseConfig -Raw
  if ($content -notmatch "export const db") {
    $content += "`nimport { getFirestore } from 'firebase/firestore';"
    $content += "`nexport const db = app ? getFirestore(app) : null;"
    Set-Content $firebaseConfig $content -Encoding UTF8
    Write-Host "✓ Firebase db export added" -ForegroundColor Green
  }
}

# 4. Normalize encoding for TS/TSX files
Get-ChildItem src -Recurse -Include *.ts,*.tsx | ForEach-Object {
  $text = Get-Content $_.FullName -Raw
  Set-Content $_.FullName $text -Encoding UTF8
}

Write-Host "✓ Encoding normalized" -ForegroundColor Green

# 5. Clear Next.js cache
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✓ .next cache cleared" -ForegroundColor Green

Write-Host "`n🎉 Build Doctor completed successfully" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  npm run build"
Write-Host "  git add ."
Write-Host "  git commit -m `"chore: stabilize build and typescript`""
Write-Host "  git push"
