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
import { eq, and } from "drizzle-orm";

import { v4 as uuidv4 } from "uuid";

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  repeatType: z.enum(["once", "daily", "weekly", "monthly", "cron"]).optional(),
  cronExpression: z.string().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
  conditions: z.record(z.number()).nullable().optional(),
  items: z.array(z.object({
    command: z.enum(["capture_photo", "capture_video", "record_audio", "stream_video", "reboot", "update_firmware", "custom"]),
    commandPayload: z.any().optional(),
    orderIndex: z.number().min(0).default(0),
    durationSeconds: z.number().nullable().optional(),
  })).optional(),
  deviceIds: z.array(z.string().uuid()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get schedule
    const schedule = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, params.id), eq(schedules.orgId, member[0].orgId)))
      .limit(1);

    if (!schedule || schedule.length === 0) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Get schedule items
    const items = await db
      .select()
      .from(scheduleItems)
      .where(eq(scheduleItems.scheduleId, params.id));

    // Get device assignments
    const assignments = await db
      .select()
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.scheduleId, params.id));

    return NextResponse.json({
      schedule: schedule[0],
      items,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify schedule exists and belongs to org
    const schedule = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, params.id), eq(schedules.orgId, member[0].orgId)))
      .limit(1);

    if (!schedule || schedule.length === 0) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Validate request body
    const body = await request.json();
    const validated = updateScheduleSchema.parse(body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.repeatType !== undefined) updateData.repeatType = validated.repeatType;
    if (validated.cronExpression !== undefined) updateData.cronExpression = validated.cronExpression;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
    if (validated.conditions !== undefined) updateData.conditions = validated.conditions;

    const [updated] = await db
      .update(schedules)
      .set(updateData)
      .where(eq(schedules.id, params.id))
      .returning();

    // Replace items if provided
    if (validated.items) {
      await db.delete(scheduleItems).where(eq(scheduleItems.scheduleId, params.id));
      if (validated.items.length > 0) {
        await db.insert(scheduleItems).values(
          validated.items.map((item) => ({
            id: uuidv4(),
            scheduleId: params.id,
            command: item.command,
            commandPayload: item.commandPayload || {},
            orderIndex: item.orderIndex,
            durationSeconds: item.durationSeconds || null,
          }))
        );
      }
    }

    // Replace device assignments if provided
    if (validated.deviceIds) {
      await db.delete(scheduleAssignments).where(eq(scheduleAssignments.scheduleId, params.id));
      if (validated.deviceIds.length > 0) {
        await db.insert(scheduleAssignments).values(
          validated.deviceIds.map((deviceId) => ({
            id: uuidv4(),
            scheduleId: params.id,
            deviceId,
          }))
        );
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify schedule exists and belongs to org
    const schedule = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, params.id), eq(schedules.orgId, member[0].orgId)))
      .limit(1);

    if (!schedule || schedule.length === 0) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Delete schedule items and assignments (cascade)
    await db
      .delete(scheduleItems)
      .where(eq(scheduleItems.scheduleId, params.id));

    await db
      .delete(scheduleAssignments)
      .where(eq(scheduleAssignments.scheduleId, params.id));

    // Delete schedule
    await db.delete(schedules).where(eq(schedules.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
