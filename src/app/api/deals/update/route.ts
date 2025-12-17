import { NextResponse } from 'next/server';

const STATUS_MAP: Record<string, number> = {
  prospect: 0,
  qualified: 1,
  proposal: 2,
  won: 3,
  lost: 4,
};

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    const dolibarrStatus = STATUS_MAP[status];

    await fetch(
      \\/comm/propal/\\,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          DOLAPIKEY: process.env.DOLIBARR_API_KEY!,
        },
        body: JSON.stringify({ statut: dolibarrStatus }),
      }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
