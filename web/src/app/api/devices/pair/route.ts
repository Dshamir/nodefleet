import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { devices, deviceTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const pairSchema = z.object({
  pairingCode: z.string().min(1).max(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pairingCode } = pairSchema.parse(body);

    // Find device by pairing code
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.pairingCode, pairingCode))
      .limit(1);

    if (!device) {
      return NextResponse.json({ error: "Invalid pairing code" }, { status: 400 });
    }

    // Check expiry
    if (device.pairingCodeExpiresAt && new Date() > device.pairingCodeExpiresAt) {
      return NextResponse.json({ error: "Pairing code has expired" }, { status: 400 });
    }

    // Check status
    if (device.status === "online" || device.status === "offline") {
      return NextResponse.json({ error: "Device is already paired" }, { status: 400 });
    }

    // Generate JWT for the device (365 days)
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET not configured");
    }

    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const deviceToken = jwt.sign(
      {
        deviceId: device.id,
        orgId: device.orgId,
        tokenId,
        type: "device",
      },
      secret,
      { expiresIn: "365d" }
    );

    // Store the token
    await db.insert(deviceTokens).values({
      deviceId: device.id,
      token: deviceToken.slice(-64), // Store last 64 chars as identifier
      issuedAt: new Date(),
      expiresAt,
    });

    // Update device to online status
    await db
      .update(devices)
      .set({
        status: "online",
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(devices.id, device.id));

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      deviceName: device.name,
      orgId: device.orgId,
      token: deviceToken,
      expiresIn: "365d",
      wsUrl: process.env.WS_SERVER_URL || "ws://localhost:8080",
      message: "Device paired successfully. Use the token to connect via WebSocket.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error pairing device:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
