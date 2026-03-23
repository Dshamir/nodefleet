import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices, orgMembers, telemetryRecords, gpsRecords } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generatePairingCode } from "@/lib/utils";

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  hwModel: z.string().min(1).max(255).optional(),
  fleetId: z.string().uuid().nullable().optional(),
  firmwareVersion: z.string().max(50).nullable().optional(),
  status: z.enum(["online", "offline", "pairing", "disabled"]).optional(),
  metadata: z.record(z.any()).optional(),
  regeneratePairingCode: z.boolean().optional(),
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

    const recentTelemetry = await db
      .select()
      .from(telemetryRecords)
      .where(eq(telemetryRecords.deviceId, params.id))
      .orderBy(desc(telemetryRecords.timestamp))
      .limit(10);

    const recentGps = await db
      .select()
      .from(gpsRecords)
      .where(eq(gpsRecords.deviceId, params.id))
      .orderBy(desc(gpsRecords.timestamp))
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

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.hwModel !== undefined) updateData.hwModel = validated.hwModel;
    if (validated.fleetId !== undefined) updateData.fleetId = validated.fleetId;
    if (validated.firmwareVersion !== undefined) updateData.firmwareVersion = validated.firmwareVersion;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.metadata !== undefined) updateData.metadata = validated.metadata;

    // Regenerate pairing code (for expired codes or re-pairing)
    if (validated.regeneratePairingCode) {
      let newCode: string;
      let attempts = 0;
      do {
        newCode = generatePairingCode(6);
        const dup = await db.select({ id: devices.id }).from(devices)
          .where(eq(devices.pairingCode, newCode)).limit(1);
        if (dup.length === 0) break;
        attempts++;
      } while (attempts < 10);
      updateData.pairingCode = newCode!;
      updateData.pairingCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      updateData.status = "pairing";
    }

    const [updated] = await db
      .update(devices)
      .set(updateData)
      .where(eq(devices.id, params.id))
      .returning();

    return NextResponse.json(updated);
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
