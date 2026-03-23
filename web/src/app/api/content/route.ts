import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaFiles, orgMembers } from "@/lib/db/schema";
import { eq, and, desc, ilike, sql } from "drizzle-orm";

const createMediaSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().min(0),
  s3Key: z.string().min(1),
  fileId: z.string().min(1),
  type: z.enum(["image", "video", "document", "other"]).optional(),
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
    const type = url.searchParams.get("type");
    const search = url.searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    // Build where clause
    let whereConditions = [eq(mediaFiles.orgId, member[0].orgId)];

    if (search) {
      whereConditions.push(ilike(mediaFiles.filename, `%${search}%`));
    }

    if (type && ["image", "video", "document", "other"].includes(type)) {
      whereConditions.push(eq(mediaFiles.type, type));
    }

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`CAST(COUNT(*) as INTEGER)` })
      .from(mediaFiles)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get media files
    const files = await db
      .select()
      .from(mediaFiles)
      .where(and(...whereConditions))
      .orderBy(desc(mediaFiles.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching media files:", error);
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
    const validated = createMediaSchema.parse(body);

    // Determine file type from contentType if not provided
    let fileType: "image" | "video" | "document" | "other" = validated.type || "other";
    if (!validated.type) {
      if (validated.contentType.startsWith("image/")) fileType = "image";
      else if (validated.contentType.startsWith("video/")) fileType = "video";
      else if (
        validated.contentType.includes("pdf") ||
        validated.contentType.includes("document") ||
        validated.contentType.includes("word")
      )
        fileType = "document";
    }

    // Create media file record
    const newFile = await db
      .insert(mediaFiles)
      .values({
        orgId: member[0].orgId,
        filename: validated.filename,
        contentType: validated.contentType,
        size: validated.size,
        s3Key: validated.s3Key,
        type: fileType,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json(newFile[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating media file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
