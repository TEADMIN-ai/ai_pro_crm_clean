Get-ChildItem src -Recurse -Include *.jsx,*.ts,*.tsx | ForEach-Object {
    try {
        $content = Get-Content $_.FullName -Raw

        # --- Convert JSX to TSX only when TypeScript syntax exists ---
        if ($_.Extension -eq ".jsx" -and ($content -match "import type|" -or $content -match "<[A-Z][A-Za-z0-9]*")) {
            $newPath = $_.FullName -replace "\.jsx$", ".tsx"
            Move-Item $_.FullName $newPath -Force
            $_ = Get-Item $newPath
            $content = Get-Content $_.FullName -Raw
        }

        # --- Ensure 'use client' is the FIRST line ---
        if ($content -match '"use client"' -and $content -notmatch '^\s*"use client"') {
            $content = $content -replace '"use client";?', ''
            $content = '"use client";' + "`n" + $content
        }

        # --- Prevent Firebase from running during build ---
        if ($content -match "firebase/firestore" -and $content -notmatch "typeof window") {
            $content = $content -replace "useEffect\(\(\)\s*=>\s*\{",
@"
useEffect(() => {
  if (typeof window === "undefined") return;
"@
        }

        Set-Content $_.FullName $content -Encoding UTF8
        Write-Host "✔ Fixed:" $_.FullName
    }
    catch {
        Write-Host "⚠ Skipped:" $_.FullName
    }
}

# --- Clean Next build ---
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue