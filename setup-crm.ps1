# Step 1: Define file content
$files = @{
    "src/app/dashboard/layout.tsx" = @"
"use client";

import LogoutButton from "@/components/LogoutButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <LogoutButton />
      {children}
    </div>
  );
}
"@

    "src/components/LogoutButton.tsx" = @"
'use client';

import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button onClick={async () => {
      await signOut(auth);
      router.push('/login');
    }}>
      Logout
    </button>
  );
}
"@

    "src/app/api/deals/route.ts" = @"
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(\`\${process.env.NEXT_PUBLIC_DOLIBARR_API_URL}/deals\`);
    const deals = await res.json();

    const formatted = deals.map((deal: any) => ({
      id: deal.id,
      title: deal.title,
      status: deal.status
    }));

    return NextResponse.json({ data: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
"@

    "src/app/dashboard/deals/page.tsx" = @"
'use client';

import { useEffect, useState } from 'react';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    async function fetchDeals() {
      const res = await fetch('/api/deals');
      const data = await res.json();
      setDeals(data.data);
    }

    fetchDeals();
  }, []);

  return (
    <div>
      <h1>Deals Kanban</h1>
      <ul>
        {deals.map((deal: any) => (
          <li key={deal.id}>{deal.title} - {deal.status}</li>
        ))}
      </ul>
    </div>
  );
}
"@

    ".env.local" = @"
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_DOLIBARR_API_URL=https://yourdolibarr.com/api/index.php
"@

    "src/lib/firebase/config.ts" = @"
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
"@
}

# Step 2: Create files and folders
foreach ($path in $files.Keys) {
    $fullPath = Join-Path -Path "." -ChildPath $path
    $dir = Split-Path $fullPath -Parent

    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Set-Content -Path $fullPath -Value $files[$path]
    Write-Host "✅ Created: $path"
}

# Step 3: Git auto commit and push
Write-Host "🔄 Staging files..."
git add . 
git commit -m "🚀 Auto-generated CRM structure, Firebase config, and .env"
git push origin master

Write-Host "`n✅ All CRM setup steps completed and pushed to GitHub!"
