import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const STATUS_MAP: Record<string, number> = {
  prospect: 0,
  qualified: 1,
  proposal: 2,
  won: 3,
  lost: 4,
};

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(token);
    const role = decoded.role || 'staff';

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, status } = await req.json();

    await fetch(
      \\/comm/propal/\\,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          DOLAPIKEY: process.env.DOLIBARR_API_KEY!,
        },
        body: JSON.stringify({ statut: STATUS_MAP[status] }),
      }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}



