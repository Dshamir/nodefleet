import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices, organizations, orgMembers } from "@/lib/db/schema";
import { eq, and, desc, like, ilike, sql } from "drizzle-orm";
import { generatePairingCode } from "@/lib/utils";

const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.string().default("generic"),
  metadata: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization from orgMembers
    const member = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const orgId = member[0].orgId;

    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";

    const offset = (page - 1) * limit;

    // Build where clause
    let whereConditions = [eq(devices.orgId, orgId)];

    if (search) {
      whereConditions.push(ilike(devices.name, `%${search}%`));
    }

    if (status) {
      whereConditions.push(eq(devices.status, status));
    }

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`CAST(COUNT(*) as INTEGER)` })
      .from(devices)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get devices with pagination
    const deviceList = await db
      .select()
      .from(devices)
      .where(and(...whereConditions))
      .orderBy(desc(devices.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: deviceList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
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

    // Get organization
    const member = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const orgId = member[0].orgId;

    // Validate request body
    const body = await request.json();
    const validated = createDeviceSchema.parse(body);

    // Generate pairing code
    const pairingCode = generatePairingCode();
    const pairingCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create device
    const newDevice = await db
      .insert(devices)
      .values({
        orgId,
        name: validated.name,
        description: validated.description || null,
        type: validated.type,
        status: "unpaired",
        pairingCode,
        pairingCodeExpiry,
        metadata: validated.metadata || {},
        lastHeartbeatAt: null,
      })
      .returning();

    return NextResponse.json(newDevice[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating device:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
