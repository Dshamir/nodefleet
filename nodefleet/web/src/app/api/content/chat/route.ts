import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { chatConversations, chatMessages } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createConversationSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
})

const createMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1),
  senderType: z.enum(['customer', 'ai', 'admin']),
  senderId: z.string().uuid().optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const conversationId = url.searchParams.get('conversationId')
  const status = url.searchParams.get('status') || ''
  const search = url.searchParams.get('search') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  // If conversationId is provided, return messages for that conversation
  if (conversationId) {
    // Verify conversation belongs to org
    const [conv] = await db
      .select()
      .from(chatConversations)
      .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.orgId, ctx.orgId)))
      .limit(1)

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt)

    return NextResponse.json({ conversation: conv, messages })
  }

  // Otherwise return conversations list
  const conditions: ReturnType<typeof eq>[] = [eq(chatConversations.orgId, ctx.orgId)]
  if (status && status !== 'all') conditions.push(eq(chatConversations.status, status as any))
  if (search) conditions.push(ilike(chatConversations.lastMessage, `%${search}%`))

  const data = await db
    .select()
    .from(chatConversations)
    .where(and(...conditions))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chatConversations)
    .where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'chat', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()

  // Detect whether we're creating a conversation or sending a message
  if (body.conversationId) {
    // Create a message
    const validated = createMessageSchema.parse(body)

    // Verify conversation belongs to org
    const [conv] = await db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(and(eq(chatConversations.id, validated.conversationId), eq(chatConversations.orgId, ctx.orgId)))
      .limit(1)

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const [message] = await db.insert(chatMessages).values({
      conversationId: validated.conversationId,
      body: validated.body,
      senderType: validated.senderType,
      senderId: validated.senderId || null,
    }).returning()

    // Update conversation last message
    await db.update(chatConversations).set({
      lastMessage: validated.body.substring(0, 500),
      updatedAt: new Date(),
    }).where(eq(chatConversations.id, validated.conversationId))

    return NextResponse.json(message, { status: 201 })
  }

  // Create a conversation
  const validated = createConversationSchema.parse(body)
  const [conversation] = await db.insert(chatConversations).values({
    orgId: ctx.orgId,
    customerId: validated.customerId || null,
    status: validated.status,
  }).returning()

  return NextResponse.json(conversation, { status: 201 })
}, { resource: 'chat', action: 'create' })
