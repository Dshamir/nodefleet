import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fleets } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const result = await db.select().from(fleets).where(eq(fleets.orgId, session.user.orgId));
    // Also get device count per fleet
    const fleetsWithCount = await Promise.all(result.map(async (fleet) => {
      const countResult = await db.execute(sql`SELECT count(*) as count FROM devices WHERE fleet_id = ${fleet.id}`);
      return { ...fleet, deviceCount: Number(countResult.rows[0]?.count || 0) };
    }));
    return NextResponse.json({ data: fleetsWithCount });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to fetch fleets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const id = uuidv4();
    await db.insert(fleets).values({
      id,
      orgId: session.user.orgId,
      name: body.name,
      description: body.description || null,
      location: body.location || null,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
    });
    const [created] = await db.select().from(fleets).where(eq(fleets.id, id));
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to create fleet' }, { status: 500 });
  }
}
