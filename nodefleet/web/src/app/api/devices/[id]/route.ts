import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices, orgMembers, telemetry, gpsData } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

export async function GET(
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

    const device = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, params.id), eq(devices.orgId, member[0].orgId)))
      .limit(1);

    if (!device || device.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Fetch recent telemetry (last 10 records)
    const recentTelemetry = await db
      .select()
      .from(telemetry)
      .where(eq(telemetry.deviceId, params.id))
      .orderBy(desc(telemetry.timestamp))
      .limit(10);

    // Fetch recent GPS data (last 10 points)
    const recentGps = await db
      .select()
      .from(gpsData)
      .where(eq(gpsData.deviceId, params.id))
      .orderBy(desc(gpsData.timestamp))
      .limit(10);

    return NextResponse.json({
      device: device[0],
      recentTelemetry,
      recentGps,
    });
  } catch (error) {
    console.error("Error fetching device:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
    const validated = updateDeviceSchema.parse(body);

    // Build update object
    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.metadata !== undefined) updateData.metadata = validated.metadata;

    // Update device
    const updated = await db
      .update(devices)
      .set(updateData)
      .where(eq(devices.id, params.id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating device:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Delete device (cascade deletes telemetry, gps, etc.)
    await db.delete(devices).where(eq(devices.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting device:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
