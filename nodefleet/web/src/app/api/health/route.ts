import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import redis from "@/lib/redis";

interface ComponentHealth {
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

/**
 * Comprehensive health check endpoint.
 * Returns individual component status for postgres, redis, and s3.
 * GET /api/health
 */
export async function GET() {
  const components: Record<string, ComponentHealth> = {};

  // Check PostgreSQL
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    components.postgres = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    components.postgres = {
      status: "down",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await redis.ping();
    components.redis = { status: "ok", latencyMs: Date.now() - redisStart };
  } catch (err) {
    components.redis = {
      status: "down",
      latencyMs: Date.now() - redisStart,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Check S3/MinIO
  const s3Start = Date.now();
  try {
    const endpoint = process.env.S3_ENDPOINT || "http://minio:9000";
    const res = await fetch(`${endpoint}/minio/health/live`, {
      signal: AbortSignal.timeout(3000),
    });
    components.s3 = {
      status: res.ok ? "ok" : "degraded",
      latencyMs: Date.now() - s3Start,
    };
  } catch (err) {
    components.s3 = {
      status: "down",
      latencyMs: Date.now() - s3Start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const allOk = Object.values(components).every((c) => c.status === "ok");
  const anyDown = Object.values(components).some((c) => c.status === "down");
  const overallStatus = allOk ? "ok" : anyDown ? "degraded" : "degraded";

  return NextResponse.json(
    {
      status: overallStatus,
      version: process.env.APP_VERSION || "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      components,
    },
    { status: allOk ? 200 : 503 }
  );
}
