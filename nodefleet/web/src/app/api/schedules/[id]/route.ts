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

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
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

    // Build update object
    const updateData: any = { updatedAt: new Date() };
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;

    // Update schedule
    const updated = await db
      .update(schedules)
      .set(updateData)
      .where(eq(schedules.id, params.id))
      .returning();

    return NextResponse.json(updated[0]);
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
