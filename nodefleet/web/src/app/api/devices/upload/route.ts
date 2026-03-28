import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { mediaFiles } from "@/lib/db/schema";
import jwt from "jsonwebtoken";
import { generatePresignedUrl } from "@/lib/s3";
import { v4 as uuidv4 } from "uuid";

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().min(1).max(50 * 1024 * 1024),
});

function verifyDeviceToken(token: string): {
  deviceId: string;
  orgId: string;
} | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret) as any;
    if (decoded.type === "device") {
      return { deviceId: decoded.deviceId, orgId: decoded.orgId };
    }
    return null;
  } catch {
    return null;
  }
}

function getMediaType(mimeType: string): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = verifyDeviceToken(authHeader.slice(7));
    if (!verified) {
      return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
    }

    const body = await request.json();
    const validated = uploadSchema.parse(body);

    const fileId = uuidv4();
    const timestamp = Date.now();
    const s3Key = `devices/${verified.deviceId}/${timestamp}-${fileId}`;

    let uploadUrl = await generatePresignedUrl(
      s3Key,
      validated.contentType,
      validated.size
    );

    // Replace internal MinIO endpoint with public endpoint for device access
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT;
    const internalEndpoint = process.env.S3_ENDPOINT;
    if (publicEndpoint && internalEndpoint) {
      uploadUrl = uploadUrl.replace(internalEndpoint, publicEndpoint);
    }

    await db.insert(mediaFiles).values({
      id: fileId,
      deviceId: verified.deviceId,
      orgId: verified.orgId,
      type: getMediaType(validated.contentType),
      filename: validated.filename,
      originalFilename: validated.filename,
      mimeType: validated.contentType,
      s3Key,
      s3Bucket: process.env.S3_BUCKET || "nodefleet-media",
      size: validated.size,
    });

    return NextResponse.json({ uploadUrl, s3Key, fileId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error generating device upload URL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
