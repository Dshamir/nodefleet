import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devices, telemetryRecords, mediaFiles, auditLogs } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";

/**
 * Prometheus-compatible metrics endpoint.
 * Returns metrics in text/plain format for Prometheus scraping.
 * GET /api/metrics
 */
export async function GET() {
  try {
    // Gather metrics from database
    const [deviceCount] = await db.select({ count: count() }).from(devices);
    const [onlineCount] = await db.select({ count: count() }).from(devices).where(eq(devices.status, 'online'));
    const [telemetryCount] = await db.select({ count: count() }).from(telemetryRecords);
    const [mediaCount] = await db.select({ count: count() }).from(mediaFiles);
    const [auditCount] = await db.select({ count: count() }).from(auditLogs);

    const metrics = [
      '# HELP nodefleet_devices_total Total number of registered devices',
      '# TYPE nodefleet_devices_total gauge',
      `nodefleet_devices_total ${deviceCount.count}`,
      '',
      '# HELP nodefleet_devices_online Number of currently online devices',
      '# TYPE nodefleet_devices_online gauge',
      `nodefleet_devices_online ${onlineCount.count}`,
      '',
      '# HELP nodefleet_telemetry_records_total Total telemetry records stored',
      '# TYPE nodefleet_telemetry_records_total counter',
      `nodefleet_telemetry_records_total ${telemetryCount.count}`,
      '',
      '# HELP nodefleet_media_files_total Total media files stored',
      '# TYPE nodefleet_media_files_total counter',
      `nodefleet_media_files_total ${mediaCount.count}`,
      '',
      '# HELP nodefleet_audit_logs_total Total audit log entries',
      '# TYPE nodefleet_audit_logs_total counter',
      `nodefleet_audit_logs_total ${auditCount.count}`,
      '',
      '# HELP nodefleet_uptime_seconds Application uptime in seconds',
      '# TYPE nodefleet_uptime_seconds gauge',
      `nodefleet_uptime_seconds ${Math.floor(process.uptime())}`,
      '',
    ].join('\n');

    return new NextResponse(metrics, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    return new NextResponse('# Error collecting metrics\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
