import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaFiles, orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedDownloadUrl, deleteFile } from "@/lib/s3";

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

    // Verify file exists and belongs to org
    const file = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.id, params.id),
          eq(mediaFiles.orgId, member[0].orgId)
        )
      )
      .limit(1);

    if (!file || file.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Generate presigned download URL
    const downloadUrl = await getPresignedDownloadUrl(file[0].s3Key);

    return NextResponse.json({
      file: file[0],
      downloadUrl,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    console.error("Error getting download URL:", error);
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

    // Verify file exists and belongs to org
    const file = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.id, params.id),
          eq(mediaFiles.orgId, member[0].orgId)
        )
      )
      .limit(1);

    if (!file || file.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete file from S3
    await deleteFile(file[0].s3Key);

    // Delete record from database
    await db.delete(mediaFiles).where(eq(mediaFiles.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
