import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, organizations, orgMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  orgName: z.string().min(1).max(255),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json(
        { message: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validated.password, salt);

    // Create user (field: passwordHash matches schema)
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      email: validated.email,
      name: validated.name,
      passwordHash: hashedPassword,
      role: "user",
    });

    // Create organization (include required fields: slug, ownerId, storageLimit)
    const orgId = uuidv4();
    const slug = validated.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    await db.insert(organizations).values({
      id: orgId,
      name: validated.orgName,
      slug: `${slug}-${orgId.slice(0, 8)}`,
      ownerId: userId,
      plan: "free",
      deviceLimit: 3,
      storageLimit: 1073741824, // 1GB
    });

    // Create org member with owner role
    await db.insert(orgMembers).values({
      id: uuidv4(),
      userId,
      orgId,
      role: "owner",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
