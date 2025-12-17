import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(\\/deals\);
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
