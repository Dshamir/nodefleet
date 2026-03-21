import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generatePresignedUrl } from "@/lib/s3";
import { v4 as uuidv4 } from "uuid";

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().min(1).max(500 * 1024 * 1024), // 500MB max
});

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
    const validated = uploadSchema.parse(body);

    // Generate S3 key and file ID
    const fileId = uuidv4();
    const timestamp = Date.now();
    const s3Key = `orgs/${member[0].orgId}/uploads/${timestamp}-${fileId}`;

    // Generate presigned upload URL
    const uploadUrl = await generatePresignedUrl(
      s3Key,
      validated.contentType,
      validated.size
    );

    return NextResponse.json({
      uploadUrl,
      s3Key,
      fileId,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error generating upload URL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
