import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  devices,
  orgMembers,
  telemetryRecords,
  deviceCommands,
} from '@/lib/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

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

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query telemetry records for last 24h
    const recentTelemetry = await db
      .select()
      .from(telemetryRecords)
      .where(
        and(
          eq(telemetryRecords.deviceId, params.id),
          gte(telemetryRecords.timestamp, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(telemetryRecords.timestamp));

    // Query commands for last 24h to calculate error rate
    const recentCommands = await db
      .select()
      .from(deviceCommands)
      .where(
        and(
          eq(deviceCommands.deviceId, params.id),
          gte(deviceCommands.createdAt, twentyFourHoursAgo)
        )
      );

    const totalCommands = recentCommands.length;
    const failedCommands = recentCommands.filter(
      (c) => c.status === 'failed' || c.status === 'timeout'
    ).length;

    // Calculate individual factor scores (0-100)

    // Uptime: based on telemetry count vs expected (1 per 30s = 2880 in 24h)
    const expectedRecords = 2880;
    const uptimeScore = Math.min(
      100,
      Math.round((recentTelemetry.length / expectedRecords) * 100)
    );

    // Error rate: 100 - (failed/total * 100), default 100 if no commands
    const errorRateScore =
      totalCommands > 0
        ? Math.round(100 - (failedCommands / totalCommands) * 100)
        : 100;

    // Battery: direct from batteryLevel (null = 100, assume plugged in)
    const latestTelemetry = recentTelemetry[0];
    const batteryScore = latestTelemetry?.batteryLevel ?? 100;

    // Signal: map signal_strength (-113 to -51 dBm) to 0-100
    const signalDbm = latestTelemetry?.signalStrength ?? -51;
    const signalScore = Math.max(
      0,
      Math.min(100, Math.round(((signalDbm + 113) / 62) * 100))
    );

    // Heartbeat: based on recency of lastHeartbeatAt
    let heartbeatScore = 0;
    if (device.lastHeartbeatAt) {
      const ageMs = now.getTime() - new Date(device.lastHeartbeatAt).getTime();
      const ageMinutes = ageMs / (1000 * 60);
      if (ageMinutes < 1) heartbeatScore = 100;
      else if (ageMinutes < 5) heartbeatScore = 80;
      else if (ageMinutes < 15) heartbeatScore = 60;
      else if (ageMinutes < 30) heartbeatScore = 30;
      else heartbeatScore = 0;
    }

    // Overall score: weighted average
    const score = Math.round(
      uptimeScore * 0.25 +
        errorRateScore * 0.2 +
        batteryScore * 0.2 +
        signalScore * 0.15 +
        heartbeatScore * 0.2
    );

    // Status determination
    let status: 'healthy' | 'degraded' | 'critical';
    if (score >= 70) status = 'healthy';
    else if (score >= 40) status = 'degraded';
    else status = 'critical';

    return NextResponse.json({
      score,
      factors: {
        uptime: uptimeScore,
        errorRate: errorRateScore,
        battery: batteryScore,
        signal: signalScore,
        heartbeat: heartbeatScore,
      },
      status,
    });
  } catch (error) {
    console.error('Error calculating device health:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
