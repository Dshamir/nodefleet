import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices, orgMembers } from "@/lib/db/schema";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { generatePairingCode } from "@/lib/utils";

const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  hwModel: z.string().min(1).max(255),
  serialNumber: z.string().min(1).max(255),
  fleetId: z.string().uuid().optional().nullable(),
  firmwareVersion: z.string().max(50).optional(),
});

export async function GET(request: NextRequest) {
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

    if (!member || member.length === 0) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const orgId = member[0].orgId;
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const fleet = url.searchParams.get("fleet") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let query = db.select().from(devices).where(eq(devices.orgId, orgId));

    const conditions = [eq(devices.orgId, orgId)];
    if (search) conditions.push(ilike(devices.name, `%${search}%`));
    if (status && status !== "all") conditions.push(eq(devices.status, status as any));
    if (fleet && fleet !== "all") {
      if (fleet === "none") {
        conditions.push(sql`${devices.fleetId} IS NULL`);
      } else {
        conditions.push(eq(devices.fleetId, fleet));
      }
    }

    const data = await db
      .select()
      .from(devices)
      .where(and(...conditions))
      .orderBy(desc(devices.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(and(...conditions));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult?.count || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching devices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (!member || member.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const orgId = member[0].orgId;
    const body = await request.json();
    const validated = createDeviceSchema.parse(body);

    // Check serial number uniqueness
    const existing = await db.select({ id: devices.id }).from(devices)
      .where(eq(devices.serialNumber, validated.serialNumber)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Serial number already exists" }, { status: 409 });
    }

    // Generate pairing code (6 chars, unique)
    let pairingCode: string;
    let attempts = 0;
    do {
      pairingCode = generatePairingCode(6);
      const dup = await db.select({ id: devices.id }).from(devices)
        .where(eq(devices.pairingCode, pairingCode)).limit(1);
      if (dup.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const [newDevice] = await db
      .insert(devices)
      .values({
        orgId,
        name: validated.name,
        hwModel: validated.hwModel,
        serialNumber: validated.serialNumber,
        pairingCode,
        pairingCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        status: "pairing",
        firmwareVersion: validated.firmwareVersion || null,
        fleetId: validated.fleetId || null,
      })
      .returning();

    return NextResponse.json({
      ...newDevice,
      message: `Device created. Use pairing code ${pairingCode} on the ESP32 to connect.`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating device:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
