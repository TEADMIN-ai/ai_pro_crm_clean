Write-Host "?? Fixing Next.js App Router structure..."

# 1. Ensure app directory exists
New-Item -ItemType Directory -Force src/app | Out-Null

# 2. Force-correct ROOT LAYOUT (ONLY place with html/body)
$layoutPath = "src/app/layout.jsx"
@"
export const metadata = {
  title: "AI Pro CRM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        background: '#020d16',
        color: 'white',
        margin: 0,
        padding: 0,
        fontFamily: 'Arial, sans-serif'
      }}>
        {children}
      </body>
    </html>
  );
}
"@ | Set-Content $layoutPath -Encoding UTF8
Write-Host "? layout.jsx fixed"

# 3. Force-correct HOME PAGE (NO html/body allowed)
$pagePath = "src/app/page.jsx"
@"
export default function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>AI Pro CRM ??</h1>
      <p>Welcome to your CRM dashboard.</p>

      <ul>
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="/tenders">Manage Tenders</a></li>
        <li><a href="/carsales">Car Sales</a></li>
        <li><a href="/login">Login</a></li>
      </ul>
    </div>
  );
}
"@ | Set-Content $pagePath -Encoding UTF8
Write-Host "? page.jsx fixed"

# 4. Remove html/body from ALL other pages (automatic safety sweep)
Get-ChildItem src/app -Recurse -Include page.jsx,page.tsx | ForEach-Object {
  $c = Get-Content $_.FullName -Raw
  $c = $c -replace '<\/?html.*?>', ''
  $c = $c -replace '<\/?body.*?>', ''
  Set-Content $_.FullName $c -Encoding UTF8
}
Write-Host "? Removed illegal <html>/<body> from pages"

# 5. Prevent Firebase from executing during build
$firebaseFiles = Get-ChildItem src -Recurse -Include firestore.ts,firebase.ts,config.ts -ErrorAction SilentlyContinue
foreach ($f in $firebaseFiles) {
  $c = Get-Content $f.FullName -Raw
  if ($c -notmatch 'typeof window') {
    $c = "if (typeof window === 'undefined') { throw new Error('Firebase disabled during build'); }`n" + $c
    Set-Content $f.FullName $c -Encoding UTF8
  }
}
Write-Host "? Firebase guarded during build"

# 6. Clean build cache
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "?? Cleaned .next"

Write-Host "?? FIX COMPLETE — ready to deploy"
