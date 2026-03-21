import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  schedules,
  scheduleItems,
  scheduleAssignments,
  orgMembers,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        sequence: z.number().min(0),
        contentType: z.enum(["image", "video", "text", "command"]),
        contentId: z.string().min(1),
        duration: z.number().min(1),
        metadata: z.record(z.any()).optional(),
      })
    )
    .optional(),
  deviceIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const offset = (page - 1) * limit;

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`CAST(COUNT(*) as INTEGER)` })
      .from(schedules)
      .where(eq(schedules.orgId, member[0].orgId));

    const total = totalResult[0]?.count || 0;

    // Get schedules
    const scheduleList = await db
      .select()
      .from(schedules)
      .where(eq(schedules.orgId, member[0].orgId))
      .orderBy(desc(schedules.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: scheduleList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validated = createScheduleSchema.parse(body);

    // Create schedule
    const newSchedule = await db
      .insert(schedules)
      .values({
        id: uuidv4(),
        orgId: member[0].orgId,
        name: validated.name,
        description: validated.description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const scheduleId = newSchedule[0].id;

    // Insert schedule items if provided
    if (validated.items && validated.items.length > 0) {
      const itemsToInsert = validated.items.map((item) => ({
        id: uuidv4(),
        scheduleId,
        sequence: item.sequence,
        contentType: item.contentType,
        contentId: item.contentId,
        duration: item.duration,
        metadata: item.metadata || {},
      }));

      await db.insert(scheduleItems).values(itemsToInsert);
    }

    // Insert device assignments if provided
    if (validated.deviceIds && validated.deviceIds.length > 0) {
      const assignmentsToInsert = validated.deviceIds.map((deviceId) => ({
        id: uuidv4(),
        scheduleId,
        deviceId,
        createdAt: new Date(),
      }));

      await db.insert(scheduleAssignments).values(assignmentsToInsert);
    }

    return NextResponse.json(newSchedule[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
