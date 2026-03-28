import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { devices, orgMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

const RANGE_MAP: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const INTERVAL_MAP: Record<string, string> = {
  '5m': '5 minutes',
  '15m': '15 minutes',
  '30m': '30 minutes',
  '1h': '1 hour',
  '6h': '6 hours',
  '1d': '1 day',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify organization membership
    const member = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify device exists and belongs to org
    const [device] = await db
      .select()
      .from(devices)
      .where(
        and(eq(devices.id, params.id), eq(devices.orgId, member[0].orgId))
      );

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '24h';
    const interval = searchParams.get('interval') || '1h';

    const rangeMs = RANGE_MAP[range];
    if (!rangeMs) {
      return NextResponse.json(
        { error: `Invalid range. Use: ${Object.keys(RANGE_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    const pgInterval = INTERVAL_MAP[interval];
    if (!pgInterval) {
      return NextResponse.json(
        {
          error: `Invalid interval. Use: ${Object.keys(INTERVAL_MAP).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const startTime = new Date(Date.now() - rangeMs);

    const result = await db.execute(sql`
      SELECT
        date_trunc(${pgInterval}, timestamp) as bucket,
        MIN(cpu_temp) as min_temp,
        MAX(cpu_temp) as max_temp,
        AVG(cpu_temp) as avg_temp,
        MIN(signal_strength) as min_signal,
        MAX(signal_strength) as max_signal,
        AVG(signal_strength) as avg_signal,
        MIN(battery_level) as min_battery,
        MAX(battery_level) as max_battery,
        AVG(battery_level) as avg_battery,
        MIN(free_memory) as min_memory,
        MAX(free_memory) as max_memory,
        AVG(free_memory) as avg_memory,
        COUNT(*) as sample_count
      FROM telemetry_records
      WHERE device_id = ${params.id}
        AND timestamp >= ${startTime}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    return NextResponse.json({
      deviceId: params.id,
      range,
      interval,
      buckets: result.rows,
    });
  } catch (error) {
    console.error('Error aggregating telemetry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
