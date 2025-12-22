import { NextResponse } from 'next/server';

const STATUS_MAP: Record<number, string> = {
  0: 'prospect',
  1: 'qualified',
  2: 'proposal',
  3: 'won',
  4: 'lost',
};

export async function GET() {
  try {
    const res = await fetch(
      \\/comm/propal\,
      {
        headers: {
          DOLAPIKEY: process.env.DOLIBARR_API_KEY!,
        },
      }
    );

    const raw = await res.json();

    const deals = raw.map((d: any) => ({
      id: d.id,
      ref: d.ref,
      title: d.ref,
      amount: d.total_ht,
      status: STATUS_MAP[d.statut] ?? 'prospect',
    }));

    return NextResponse.json(deals);
  } catch (e) {
    return NextResponse.json({ error: 'Deals fetch failed' }, { status: 500 });
  }
}


