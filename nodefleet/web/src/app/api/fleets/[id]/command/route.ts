import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fleets, devices, deviceCommands } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { redis } from '@/lib/redis';
import { logAudit } from '@/lib/audit';

const fleetCommandSchema = z.object({
  command: z.string().min(1).max(255),
  payload: z.record(z.any()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Verify fleet belongs to org
    const [fleet] = await db
      .select()
      .from(fleets)
      .where(
        and(eq(fleets.id, params.id), eq(fleets.orgId, session.user.orgId))
      );

    if (!fleet) {
      return NextResponse.json(
        { message: 'Fleet not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validated = fleetCommandSchema.parse(body);

    // Fetch all devices in the fleet
    const fleetDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.fleetId, params.id));

    if (fleetDevices.length === 0) {
      return NextResponse.json(
        { message: 'No devices in fleet' },
        { status: 400 }
      );
    }

    const commandIds: string[] = [];

    // Create command record and push to Redis for each device
    for (const device of fleetDevices) {
      const [newCommand] = await db
        .insert(deviceCommands)
        .values({
          deviceId: device.id,
          command: validated.command,
          payload: validated.payload || {},
          status: 'pending',
          createdAt: new Date(),
        })
        .returning();

      commandIds.push(newCommand.id);

      // Push to Redis queue for WebSocket delivery
      const redisKey = `device:${device.id}:commands`;
      const commandMessage = {
        id: newCommand.id,
        command: validated.command,
        payload: validated.payload || {},
        timestamp: new Date().toISOString(),
      };

      await redis.lpush(redisKey, JSON.stringify(commandMessage));
      await redis.expire(redisKey, 24 * 60 * 60);

      // Publish notification event
      await redis.publish(
        `device:${device.id}:notification`,
        JSON.stringify({
          type: 'command',
          commandId: newCommand.id,
          command: validated.command,
        })
      );
    }

    // Log a single audit event for the fleet-wide command
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      action: 'command_sent',
      entityType: 'fleet',
      entityId: params.id,
      details: {
        command: validated.command,
        payload: validated.payload,
        deviceCount: fleetDevices.length,
        commandIds,
      },
    });

    return NextResponse.json(
      {
        fleetId: params.id,
        command: validated.command,
        deviceCount: fleetDevices.length,
        commandIds,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error sending fleet command:', error);
    return NextResponse.json(
      { message: 'Failed to send fleet command' },
      { status: 500 }
    );
  }
}
