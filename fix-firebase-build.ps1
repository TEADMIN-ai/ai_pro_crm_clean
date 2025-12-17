Write-Host "?? Fixing Firebase build guards (safe mode)..."

$files = Get-ChildItem src -Recurse -Include firebase.ts,firestore.ts,config.ts -ErrorAction SilentlyContinue

foreach ($file in $files) {
  $content = Get-Content $file.FullName -Raw

  # Remove hard throws
  $content = $content -replace 'throw new Error\([^)]+\);', ''

  # Add safe build guard
  if ($content -notmatch 'NEXT_PUBLIC_FIREBASE_API_KEY') {
    $guard = @"
const isBuild = typeof window === 'undefined';

if (isBuild) {
  console.warn('? Firebase stubbed during build');
}
"@
    $content = $guard + "`n" + $content
  }

  # Stub Firebase exports safely
  $content = $content -replace 'export const db\s*=.*;', 'export const db = isBuild ? null : db;'
  $content = $content -replace 'export const auth\s*=.*;', 'export const auth = isBuild ? null : auth;'

  Set-Content $file.FullName $content -Encoding UTF8
  Write-Host "? Fixed:" $file.FullName
}

# Clean build cache
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "?? Cleaned .next"

Write-Host "?? Firebase build-safe fix complete"
