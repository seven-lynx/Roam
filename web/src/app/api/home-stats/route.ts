import { NextResponse } from 'next/server';
import { getHomeStats } from '@/lib/home-stats';

export const dynamic = 'force-dynamic';

/** Public aggregate counters, exposed for the desktop telemetry widget. */
export async function GET() {
  const stats = await getHomeStats();
  return NextResponse.json(
    stats ?? { totalUsers: 0, totalRatings: 0, activeUrls: 0, activeTags: 0, totalServes: 0 },
  );
}
