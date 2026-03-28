import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { devices, deviceTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { logAudit } from "@/lib/audit";

const pairSchema = z.object({
  pairingCode: z.string().min(1).max(10),
});

// Simple in-memory rate limiter (10 attempts per IP per hour)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600000 });
    return true;
  }

  if (entry.count >= 10) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many pairing attempts. Try again in 1 hour." },
        { status: 429 }
      );
    }

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

    // Audit trail
    await logAudit({
      orgId: device.orgId,
      deviceId: device.id,
      action: "device_paired",
      details: { pairingCode, deviceModel: body.device_model },
      ipAddress: ip,
    });

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
