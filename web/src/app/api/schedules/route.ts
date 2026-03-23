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
  description: z.string().max(1000).optional().nullable(),
  repeatType: z.enum(["once", "daily", "weekly", "monthly", "cron"]).default("once"),
  cronExpression: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
  conditions: z.record(z.number()).optional().nullable(),
  items: z.array(z.object({
    command: z.enum(["capture_photo", "capture_video", "record_audio", "stream_video", "reboot", "update_firmware", "custom"]),
    commandPayload: z.any().optional(),
    orderIndex: z.number().min(0).default(0),
    durationSeconds: z.number().optional().nullable(),
  })).optional(),
  deviceIds: z.array(z.string().uuid()).optional(),
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgId = member[0].orgId;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Get schedules
    const data = await db
      .select()
      .from(schedules)
      .where(eq(schedules.orgId, orgId))
      .orderBy(desc(schedules.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schedules)
      .where(eq(schedules.orgId, orgId));

    // Fetch items and assignments for each schedule
    const enriched = await Promise.all(
      data.map(async (schedule) => {
        const items = await db
          .select()
          .from(scheduleItems)
          .where(eq(scheduleItems.scheduleId, schedule.id));
        const assignments = await db
          .select()
          .from(scheduleAssignments)
          .where(eq(scheduleAssignments.scheduleId, schedule.id));
        return { ...schedule, items, assignments };
      })
    );

    return NextResponse.json({
      data: enriched,
      pagination: {
        page,
        limit,
        total: Number(countResult?.count || 0),
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

    const member = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createScheduleSchema.parse(body);

    // Create schedule
    const scheduleId = uuidv4();
    const [newSchedule] = await db
      .insert(schedules)
      .values({
        id: scheduleId,
        orgId: member[0].orgId,
        name: validated.name,
        description: validated.description || null,
        repeatType: validated.repeatType,
        cronExpression: validated.cronExpression || null,
        isActive: validated.isActive,
        conditions: validated.conditions || null,
      })
      .returning();

    // Insert items
    if (validated.items && validated.items.length > 0) {
      await db.insert(scheduleItems).values(
        validated.items.map((item) => ({
          id: uuidv4(),
          scheduleId,
          command: item.command,
          commandPayload: item.commandPayload || {},
          orderIndex: item.orderIndex,
          durationSeconds: item.durationSeconds || null,
        }))
      );
    }

    // Insert device assignments
    if (validated.deviceIds && validated.deviceIds.length > 0) {
      await db.insert(scheduleAssignments).values(
        validated.deviceIds.map((deviceId) => ({
          id: uuidv4(),
          scheduleId,
          deviceId,
        }))
      );
    }

    return NextResponse.json(newSchedule, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
