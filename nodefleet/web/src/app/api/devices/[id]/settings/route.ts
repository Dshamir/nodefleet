import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices, deviceSettings, orgMembers, deviceCommands } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { redis } from "@/lib/redis";
import { v4 as uuidv4 } from "uuid";

const settingsSchema = z.object({
  cameraEnabled: z.boolean().optional(),
  audioEnabled: z.boolean().optional(),
  gpsEnabled: z.boolean().optional(),
  lteEnabled: z.boolean().optional(),
  mqttEnabled: z.boolean().optional(),
  heartbeatInterval: z.number().min(5000).max(300000).optional(),
  gpsInterval: z.number().min(10000).max(600000).optional(),
  cameraResolution: z.enum(["QVGA", "VGA", "SVGA", "XGA"]).optional(),
  audioSampleRate: z.enum(["8000", "16000", "22050", "44100"]).optional(),
  powerMode: z.enum(["active", "idle", "sleep"]).optional(),
});

// GET: Retrieve device settings
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings = await db
      .select()
      .from(deviceSettings)
      .where(eq(deviceSettings.deviceId, params.id))
      .limit(1);

    if (!settings.length) {
      // Create default settings
      const [newSettings] = await db
        .insert(deviceSettings)
        .values({ deviceId: params.id })
        .returning();
      return NextResponse.json(newSettings);
    }

    return NextResponse.json(settings[0]);
  } catch (error) {
    console.error("Error fetching device settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update device settings and push to device
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, session.user.id))
      .limit(1);

    if (!member.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = settingsSchema.parse(body);

    // Upsert settings
    const existing = await db
      .select()
      .from(deviceSettings)
      .where(eq(deviceSettings.deviceId, params.id))
      .limit(1);

    let settings;
    if (existing.length) {
      [settings] = await db
        .update(deviceSettings)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(deviceSettings.deviceId, params.id))
        .returning();
    } else {
      [settings] = await db
        .insert(deviceSettings)
        .values({ deviceId: params.id, ...validated })
        .returning();
    }

    // Push each changed setting to device via set_config commands
    const configMap: Record<string, string> = {};
    if (validated.cameraEnabled !== undefined) configMap.camera_enabled = validated.cameraEnabled ? "1" : "0";
    if (validated.audioEnabled !== undefined) configMap.audio_enabled = validated.audioEnabled ? "1" : "0";
    if (validated.gpsEnabled !== undefined) configMap.gps_enabled = validated.gpsEnabled ? "1" : "0";
    if (validated.lteEnabled !== undefined) configMap.lte_enabled = validated.lteEnabled ? "1" : "0";
    if (validated.mqttEnabled !== undefined) configMap.mqtt_enabled = validated.mqttEnabled ? "1" : "0";
    if (validated.heartbeatInterval !== undefined) configMap.hb_interval = String(validated.heartbeatInterval);
    if (validated.gpsInterval !== undefined) configMap.gps_interval = String(validated.gpsInterval);
    if (validated.powerMode !== undefined) configMap.power_mode = validated.powerMode;

    // Queue set_config commands for each changed setting
    for (const [key, value] of Object.entries(configMap)) {
      const commandId = uuidv4();
      await db.insert(deviceCommands).values({
        id: commandId,
        deviceId: params.id,
        command: "set_config",
        payload: { key, value },
        status: "pending",
        createdAt: new Date(),
      });
      await redis.lpush(
        `device:${params.id}:commands`,
        JSON.stringify({ id: commandId, command: "set_config", payload: { key, value } })
      );
    }

    // Audit log
    await logAudit({
      orgId: member[0].orgId,
      userId: session.user.id,
      deviceId: params.id,
      action: "settings_changed",
      details: validated as Record<string, unknown>,
    });

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating device settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
