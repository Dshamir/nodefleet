import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { protocolSettings, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

const DATA_TYPES = ["telemetry", "gps", "media", "commands", "status", "alerts"] as const;

const DEFAULT_SETTINGS: Record<string, { websocket: boolean; mqtt: boolean; http: boolean }> = {
  telemetry: { websocket: true, mqtt: true, http: false },
  gps:       { websocket: true, mqtt: true, http: false },
  media:     { websocket: false, mqtt: false, http: true },
  commands:  { websocket: true, mqtt: false, http: false },
  status:    { websocket: true, mqtt: true, http: false },
  alerts:    { websocket: true, mqtt: true, http: true },
};

// GET: Retrieve protocol routing settings for the org
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

    // Fetch existing settings
    const existing = await db
      .select()
      .from(protocolSettings)
      .where(eq(protocolSettings.orgId, orgId));

    // Build response with defaults for missing data types
    const result: Record<string, { websocket: boolean; mqtt: boolean; http: boolean }> = {};

    for (const dt of DATA_TYPES) {
      const found = existing.find((s) => s.dataType === dt);
      if (found) {
        result[dt] = {
          websocket: found.websocketEnabled,
          mqtt: found.mqttEnabled,
          http: found.httpEnabled,
        };
      } else {
        result[dt] = DEFAULT_SETTINGS[dt];
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching protocol settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update protocol routing settings
const updateSchema = z.record(
  z.enum(DATA_TYPES),
  z.object({
    websocket: z.boolean(),
    mqtt: z.boolean(),
    http: z.boolean(),
  })
);

export async function PUT(request: NextRequest) {
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
    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Upsert each data type
    for (const [dataType, protocols] of Object.entries(validated)) {
      const existing = await db
        .select()
        .from(protocolSettings)
        .where(and(eq(protocolSettings.orgId, orgId), eq(protocolSettings.dataType, dataType)))
        .limit(1);

      if (existing.length) {
        await db
          .update(protocolSettings)
          .set({
            websocketEnabled: protocols.websocket,
            mqttEnabled: protocols.mqtt,
            httpEnabled: protocols.http,
            updatedAt: new Date(),
          })
          .where(eq(protocolSettings.id, existing[0].id));
      } else {
        await db.insert(protocolSettings).values({
          orgId,
          dataType,
          websocketEnabled: protocols.websocket,
          mqttEnabled: protocols.mqtt,
          httpEnabled: protocols.http,
        });
      }
    }

    await logAudit({
      orgId,
      userId: session.user.id,
      action: "settings_changed",
      details: { section: "protocol_routing", ...validated },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating protocol settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
