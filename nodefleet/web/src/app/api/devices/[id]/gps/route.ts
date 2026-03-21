import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices, gpsData, orgMembers } from "@/lib/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

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

    // Verify device exists and belongs to org
    const device = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, params.id), eq(devices.orgId, member[0].orgId)))
      .limit(1);

    if (!device || device.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const page = parseInt(url.searchParams.get("page") || "1");

    const offset = (page - 1) * limit;

    // Build where clause
    let whereConditions = [eq(gpsData.deviceId, params.id)];

    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        whereConditions.push(gte(gpsData.timestamp, fromDate));
      }
    }

    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        whereConditions.push(lte(gpsData.timestamp, toDate));
      }
    }

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`CAST(COUNT(*) as INTEGER)` })
      .from(gpsData)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get GPS records
    const records = await db
      .select()
      .from(gpsData)
      .where(and(...whereConditions))
      .orderBy(desc(gpsData.timestamp))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching GPS data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
