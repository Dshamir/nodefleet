import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fleets, devices } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const [fleet] = await db.select().from(fleets).where(and(eq(fleets.id, params.id), eq(fleets.orgId, session.user.orgId)));
    if (!fleet) return NextResponse.json({ message: 'Fleet not found' }, { status: 404 });
    const fleetDevices = await db.select().from(devices).where(eq(devices.fleetId, params.id));
    return NextResponse.json({ ...fleet, devices: fleetDevices });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to fetch fleet' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    await db.update(fleets).set({
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.latitude !== undefined && { latitude: body.latitude }),
      ...(body.longitude !== undefined && { longitude: body.longitude }),
      updatedAt: new Date(),
    }).where(and(eq(fleets.id, params.id), eq(fleets.orgId, session.user.orgId)));
    const [updated] = await db.select().from(fleets).where(eq(fleets.id, params.id));
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update fleet' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    // Unassign devices from fleet before deleting
    await db.update(devices).set({ fleetId: null }).where(eq(devices.fleetId, params.id));
    await db.delete(fleets).where(and(eq(fleets.id, params.id), eq(fleets.orgId, session.user.orgId)));
    return NextResponse.json({ message: 'Fleet deleted' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete fleet' }, { status: 500 });
  }
}
