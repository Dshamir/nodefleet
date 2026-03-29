import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest, _ctx: AuthContext) => {
  // Table sizes and row counts from pg_stat_user_tables
  const tablesResult = await db.execute(sql`
    SELECT
      schemaname,
      relname AS table_name,
      n_live_tup AS row_count,
      pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) AS total_bytes,
      pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))) AS total_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) DESC
  `)

  // Database size
  const dbSizeResult = await db.execute(sql`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
           pg_database_size(current_database()) AS db_size_bytes
  `)

  // Connection count
  const connResult = await db.execute(sql`
    SELECT count(*) AS active_connections FROM pg_stat_activity WHERE state = 'active'
  `)

  const rows = tablesResult as unknown as Record<string, unknown>[]
  const dbRow = (dbSizeResult as unknown as Record<string, unknown>[])[0] || {}
  const connRow = (connResult as unknown as Record<string, unknown>[])[0] || {}

  return NextResponse.json({
    databaseSize: (dbRow.db_size as string) || 'N/A',
    databaseSizeBytes: Number(dbRow.db_size_bytes || 0),
    activeConnections: Number(connRow.active_connections || 0),
    tables: rows.map((t) => ({
      name: t.table_name,
      rowCount: Number(t.row_count || 0),
      totalSize: t.total_size,
      totalBytes: Number(t.total_bytes || 0),
    })),
  })
}, { resource: 'operations', action: 'read' })
