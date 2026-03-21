import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { devices, telemetry } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const heartbeatSchema = z.object({
  battery: z.number().min(0).max(100),
  signal: z.number().min(-120).max(0).optional(),
  cpuTemp: z.number().optional(),
  freeMemory: z.number().min(0).optional(),
  uptime: z.number().min(0).optional(),
});

function verifyDeviceToken(token: string): {
  deviceId: string;
  orgId: string;
} | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET not configured");
    }

    const decoded = jwt.verify(token, secret) as any;
    if (decoded.type === "device") {
      return {
        deviceId: decoded.deviceId,
        orgId: decoded.orgId,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extract and verify device token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const verified = verifyDeviceToken(token);

    if (!verified) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validated = heartbeatSchema.parse(body);

    // Verify device exists
    const device = await db
      .select()
      .from(devices)
      .where(eq(devices.id, verified.deviceId))
      .limit(1);

    if (!device || device.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Update device lastHeartbeatAt
    await db
      .update(devices)
      .set({
        lastHeartbeatAt: new Date(),
        status: "online",
      })
      .where(eq(devices.id, verified.deviceId));

    // Insert telemetry record
    await db.insert(telemetry).values({
      deviceId: verified.deviceId,
      batteryLevel: validated.battery,
      signalStrength: validated.signal ?? null,
      cpuTemp: validated.cpuTemp ?? null,
      freeMemory: validated.freeMemory ?? null,
      uptimeSeconds: validated.uptime ?? null,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error processing heartbeat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
