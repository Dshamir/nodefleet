import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, orgMembers, users, devices } from "@/lib/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

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

    if (!member.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgId = member[0].orgId;
    const { searchParams } = new URL(request.url);

    const deviceId = searchParams.get("deviceId");
    const action = searchParams.get("action");
    const range = searchParams.get("range") || "7d";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Calculate date range
    const rangeMap: Record<string, number> = {
      "1h": 3600000,
      "6h": 21600000,
      "24h": 86400000,
      "7d": 604800000,
      "30d": 2592000000,
      "90d": 7776000000,
    };
    const rangeMs = rangeMap[range] || rangeMap["7d"];
    const since = new Date(Date.now() - rangeMs);

    const conditions = [
      eq(auditLogs.orgId, orgId),
      gte(auditLogs.createdAt, since),
    ];

    if (deviceId) {
      conditions.push(eq(auditLogs.deviceId, deviceId));
    }
    if (action) {
      conditions.push(eq(auditLogs.action, action as any));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        deviceId: auditLogs.deviceId,
      })
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(...conditions));

    return NextResponse.json({
      logs,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
