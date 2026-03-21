import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices, deviceCommands, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { redis } from "@/lib/redis";

const sendCommandSchema = z.object({
  command: z.string().min(1).max(255),
  payload: z.record(z.any()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify organization ownership
    const member = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify device exists and belongs to org
    const device = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, params.id), eq(devices.orgId, member[0].orgId)))
      .limit(1);

    if (!device || device.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Validate request body
    const body = await request.json();
    const validated = sendCommandSchema.parse(body);

    // Create device command record
    const newCommand = await db
      .insert(deviceCommands)
      .values({
        deviceId: params.id,
        orgId: member[0].orgId,
        command: validated.command,
        payload: validated.payload || {},
        status: "pending",
        createdAt: new Date(),
      })
      .returning();

    const commandId = newCommand[0].id;

    // Publish to Redis for WebSocket delivery
    const redisKey = `device:${params.id}:commands`;
    const commandMessage = {
      id: commandId,
      command: validated.command,
      payload: validated.payload || {},
      timestamp: new Date().toISOString(),
    };

    await redis.lpush(redisKey, JSON.stringify(commandMessage));
    // Set expiration on command queue (24 hours)
    await redis.expire(redisKey, 24 * 60 * 60);

    // Publish notification event for WebSocket subscribers
    await redis.publish(
      `device:${params.id}:notification`,
      JSON.stringify({
        type: "command",
        commandId,
        command: validated.command,
      })
    );

    return NextResponse.json(
      {
        id: commandId,
        status: "pending",
        command: validated.command,
        payload: validated.payload || {},
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error sending command:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
