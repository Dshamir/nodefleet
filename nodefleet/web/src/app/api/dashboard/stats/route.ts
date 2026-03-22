import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { devices, mediaFiles, deviceCommands, telemetryRecords } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.user.orgId;

    // Total devices
    const [deviceCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(eq(devices.orgId, orgId));

    // Online devices (heartbeat within last 90 seconds)
    const [onlineCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(
      and(eq(devices.orgId, orgId), eq(devices.status, 'online'))
    );

    // Total media files
    const [mediaCount] = await db.select({ count: sql<number>`count(*)` }).from(mediaFiles).where(eq(mediaFiles.orgId, orgId));

    // Total storage used
    const [storageResult] = await db.select({ total: sql<number>`coalesce(sum(size), 0)` }).from(mediaFiles).where(eq(mediaFiles.orgId, orgId));

    // Recent activity (last 10 commands)
    const recentCommands = await db.select({
      id: deviceCommands.id,
      command: deviceCommands.command,
      status: deviceCommands.status,
      createdAt: deviceCommands.createdAt,
      deviceId: deviceCommands.deviceId,
    }).from(deviceCommands)
      .innerJoin(devices, eq(deviceCommands.deviceId, devices.id))
      .where(eq(devices.orgId, orgId))
      .orderBy(desc(deviceCommands.createdAt))
      .limit(10);

    // Get device names for commands
    const deviceIds = [...new Set(recentCommands.map(c => c.deviceId))];
    const deviceNames: Record<string, string> = {};
    if (deviceIds.length > 0) {
      const devs = await db.select({ id: devices.id, name: devices.name }).from(devices).where(sql`${devices.id} IN ${deviceIds}`);
      devs.forEach(d => { deviceNames[d.id] = d.name; });
    }

    const activity = recentCommands.map(c => ({
      id: c.id,
      device: deviceNames[c.deviceId] || 'Unknown',
      action: c.command.replace(/_/g, ' '),
      status: c.status === 'completed' ? 'success' : c.status === 'failed' ? 'error' : 'pending',
      time: c.createdAt,
    }));

    const storageBytes = Number(storageResult?.total || 0);
    const storageFormatted = storageBytes > 1073741824
      ? `${(storageBytes / 1073741824).toFixed(1)} GB`
      : `${(storageBytes / 1048576).toFixed(1)} MB`;

    return NextResponse.json({
      stats: {
        totalDevices: Number(deviceCount?.count || 0),
        onlineDevices: Number(onlineCount?.count || 0),
        mediaFiles: Number(mediaCount?.count || 0),
        storageUsed: storageFormatted,
      },
      activity,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ message: 'Failed to fetch stats' }, { status: 500 });
  }
}
