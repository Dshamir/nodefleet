import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";

const pairDeviceSchema = z.object({
  pairingCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json();
    const validated = pairDeviceSchema.parse(body);

    // Find device with pairing code
    const device = await db
      .select()
      .from(devices)
      .where(eq(devices.pairingCode, validated.pairingCode))
      .limit(1);

    if (!device || device.length === 0) {
      return NextResponse.json(
        { error: "Invalid pairing code" },
        { status: 400 }
      );
    }

    const foundDevice = device[0];

    // Check if pairing code has expired
    if (
      foundDevice.pairingCodeExpiry &&
      new Date() > foundDevice.pairingCodeExpiry
    ) {
      return NextResponse.json(
        { error: "Pairing code has expired" },
        { status: 400 }
      );
    }

    // Check if device is already paired
    if (foundDevice.status === "paired") {
      return NextResponse.json(
        { error: "Device is already paired" },
        { status: 400 }
      );
    }

    // Generate device JWT token
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET not configured");
    }

    const deviceToken = jwt.sign(
      {
        deviceId: foundDevice.id,
        orgId: foundDevice.orgId,
        type: "device",
      },
      secret,
      { expiresIn: "365d" }
    );

    // Update device status to paired and clear pairing code
    const updatedDevice = await db
      .update(devices)
      .set({
        status: "paired",
        pairingCode: null,
        pairingCodeExpiry: null,
        lastHeartbeatAt: new Date(),
        pairedAt: new Date(),
      })
      .where(eq(devices.id, foundDevice.id))
      .returning();

    return NextResponse.json({
      success: true,
      deviceId: updatedDevice[0].id,
      deviceToken,
      expiresIn: "365d",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error pairing device:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
