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
    // Validate request body
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
        { error: "User already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validated.password, salt);

    // Create user
    const userId = uuidv4();
    const newUser = await db
      .insert(users)
      .values({
        id: userId,
        email: validated.email,
        name: validated.name,
        password: hashedPassword,
        emailVerified: null,
        image: null,
      })
      .returning();

    // Create organization
    const orgId = uuidv4();
    const newOrg = await db
      .insert(organizations)
      .values({
        id: orgId,
        name: validated.orgName,
        createdAt: new Date(),
      })
      .returning();

    // Create org member with owner role
    const newMember = await db
      .insert(orgMembers)
      .values({
        id: uuidv4(),
        userId,
        orgId,
        role: "owner",
        joinedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser[0].id,
          email: newUser[0].email,
          name: newUser[0].name,
        },
        organization: {
          id: newOrg[0].id,
          name: newOrg[0].name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error registering user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
