import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

export async function GET() {
  try {
    const dealsRes = await fetch(
      \\/comm/propal\,
      { headers: { DOLAPIKEY: process.env.DOLIBARR_API_KEY! } }
    );
    const deals = await dealsRes.json();

    const activitySnap = await getDocs(collection(db, 'deal_activity'));
    const activity = activitySnap.docs.map(d => d.data());

    let total = 0, won = 0, lost = 0;
    let durations: number[] = [];

    deals.forEach((d: any) => {
      if (d.statut !== 4) total += d.total_ht;
      if (d.statut === 3) won += d.total_ht;
      if (d.statut === 4) lost += d.total_ht;

      const logs = activity.filter(a => a.dealId == d.id);
      if (logs.length >= 2) {
        const first = logs[0].timestamp?.seconds;
        const last = logs[logs.length - 1].timestamp?.seconds;
        if (first && last) durations.push((last - first) / 86400);
      }
    });

    return NextResponse.json({
      pipelineValue: total,
      wonValue: won,
      lostValue: lost,
      winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
      avgDealDuration:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b) / durations.length)
          : 0,
    });
  } catch {
    return NextResponse.json({ error: 'Analytics failed' }, { status: 500 });
  }
}



