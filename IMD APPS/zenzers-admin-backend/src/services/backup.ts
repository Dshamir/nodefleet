/**
 * Backup Service
 *
 * Executes real mongodump / pg_dump backups from inside the backend container.
 * Backup files are stored under /app/backups (bind-mounted to ./backups on host).
 *
 * Uses child_process.execFile (not exec) to avoid shell injection.
 * Credentials come from environment variables set in docker-compose.yml.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);
const { getDb, ObjectId } = require('../routes/admin/db');
const logger = require('../logging').getLogger('backup');

const BACKUPS_ROOT = '/app/backups';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BackupType = 'full' | 'mongo-only' | 'pg-only';

export interface BackupRecord {
  _id?: any;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: BackupType;
  sizeBytes: number;
  collections: number;
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  path?: string;
  error?: string;
  restoreStatus?: 'pending' | 'running' | 'completed' | 'failed';
  restoreError?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively calculate total size of all files in a directory.
 */
export async function calculateDirSize(dir: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        totalSize += await calculateDirSize(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return totalSize;
}

/**
 * Count *.bson.gz files in a directory tree (MongoDB collections backed up).
 */
export function countBsonFiles(dir: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countBsonFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.bson.gz')) {
        count++;
      }
    }
  } catch {
    // Directory may not exist
  }
  return count;
}

// ---------------------------------------------------------------------------
// Dump Functions
// ---------------------------------------------------------------------------

/**
 * Run mongodump targeting the mediastore database.
 */
async function runMongoDump(outputDir: string): Promise<void> {
  const host = process.env.MONGO_BACKUP_HOST || 'mongodb';
  const username = process.env.MONGO_BACKUP_USERNAME;
  const password = process.env.MONGO_BACKUP_PASSWORD;

  const args = [
    '--host', host,
    '--port', '27017',
    '--db', 'mediastore',
    '--gzip',
    '--out', path.join(outputDir, 'mongo_dump'),
  ];

  if (username) {
    args.push('--username', username);
    args.push('--authenticationDatabase', 'admin');
  }
  if (password) {
    args.push('--password', password);
  }

  logger.info(`Running mongodump to ${outputDir}/mongo_dump`);
  const { stdout, stderr } = await execFileAsync('mongodump', args, { timeout: 300_000 });
  if (stdout) logger.debug(`mongodump stdout: ${stdout}`);
  if (stderr) logger.debug(`mongodump stderr: ${stderr}`);
}

/**
 * Run pg_dump targeting all Zenzers databases (zenzers, medical_db, keycloak).
 */
async function runPgDump(outputDir: string): Promise<void> {
  const host = process.env.PG_BACKUP_HOST || 'postgres';
  const user = process.env.PG_BACKUP_USER || 'zenzers_postgres';
  const password = process.env.PG_BACKUP_PASSWORD;
  const databases = ['zenzers', 'medical_db', 'keycloak'];

  for (const dbName of databases) {
    const outputFile = path.join(outputDir, `pg_dump_${dbName}.sql`);
    const args = [
      '-h', host,
      '-p', '5432',
      '-U', user,
      '-d', dbName,
      '-f', outputFile,
    ];

    logger.info(`Running pg_dump for ${dbName} to ${outputFile}`);
    const { stdout, stderr } = await execFileAsync('pg_dump', args, {
      timeout: 300_000,
      env: { ...process.env, PGPASSWORD: password || '' },
    });
    if (stdout) logger.debug(`pg_dump ${dbName} stdout: ${stdout}`);
    if (stderr) logger.debug(`pg_dump ${dbName} stderr: ${stderr}`);
  }
}

// ---------------------------------------------------------------------------
// Core Backup Execution
// ---------------------------------------------------------------------------

/**
 * Execute a database backup. Called asynchronously after the HTTP 202 response.
 * Updates the dbBackups document throughout the process.
 */
export async function executeBackup(
  backupId: string,
  type: BackupType,
  createdBy: string,
): Promise<void> {
  const db = await getDb();
  const col = db.collection('dbBackups');
  const startedAt = new Date();
  const dirName = startedAt.toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(BACKUPS_ROOT, dirName);

  try {
    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Mark as running
    await col.updateOne(
      { _id: new ObjectId(backupId) },
      { $set: { status: 'running', startedAt, path: outputDir } },
    );

    // Run dumps based on type
    if (type === 'full' || type === 'mongo-only') {
      await runMongoDump(outputDir);
    }
    if (type === 'full' || type === 'pg-only') {
      await runPgDump(outputDir);
    }

    // Calculate results
    const sizeBytes = await calculateDirSize(outputDir);
    const collections = countBsonFiles(outputDir);
    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    // Mark as completed
    await col.updateOne(
      { _id: new ObjectId(backupId) },
      {
        $set: {
          status: 'completed',
          sizeBytes,
          collections,
          completedAt,
          duration,
        },
      },
    );

    // Audit log
    try {
      await db.collection('auditLog').insertOne({
        userId: createdBy,
        action: 'backup:completed',
        resourceType: 'database-backup',
        resourceId: backupId,
        timestamp: completedAt,
        details: { type, sizeBytes, collections, duration, path: outputDir },
      });
    } catch {
      // Non-fatal
    }

    logger.info(
      `Backup ${backupId} completed: ${type}, ${sizeBytes} bytes, ` +
      `${collections} collections, ${duration}ms`,
    );
  } catch (err: any) {
    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    await col.updateOne(
      { _id: new ObjectId(backupId) },
      {
        $set: {
          status: 'failed',
          error: err.message,
          completedAt,
          duration,
        },
      },
    ).catch(() => {});

    logger.error(`Backup ${backupId} failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/**
 * Restore from a previously completed backup.
 * Runs mongorestore --gzip --drop + psql.
 */
export async function restoreFromBackup(backupId: string, restoredBy: string): Promise<void> {
  const db = await getDb();
  const col = db.collection('dbBackups');
  const backup = await col.findOne({ _id: new ObjectId(backupId) });

  if (!backup) throw new Error('Backup not found');
  if (backup.status !== 'completed') throw new Error('Can only restore from completed backups');
  if (!backup.path) throw new Error('Backup has no file path');

  const backupDir = backup.path;

  // Mark restore as running
  await col.updateOne(
    { _id: new ObjectId(backupId) },
    { $set: { restoreStatus: 'running' } },
  );

  try {
    // Restore MongoDB
    const mongoDumpDir = path.join(backupDir, 'mongo_dump');
    if (fs.existsSync(mongoDumpDir)) {
      const host = process.env.MONGO_BACKUP_HOST || 'mongodb';
      const username = process.env.MONGO_BACKUP_USERNAME;
      const password = process.env.MONGO_BACKUP_PASSWORD;

      const args = [
        '--host', host,
        '--port', '27017',
        '--db', 'mediastore',
        '--gzip',
        '--drop',
        path.join(mongoDumpDir, 'mediastore'),
      ];

      if (username) {
        args.push('--username', username);
        args.push('--authenticationDatabase', 'admin');
      }
      if (password) {
        args.push('--password', password);
      }

      logger.info(`Restoring MongoDB from ${mongoDumpDir}`);
      await execFileAsync('mongorestore', args, { timeout: 600_000 });
    }

    // Restore PostgreSQL (all databases)
    const host = process.env.PG_BACKUP_HOST || 'postgres';
    const pgUser = process.env.PG_BACKUP_USER || 'zenzers_postgres';
    const pgPassword = process.env.PG_BACKUP_PASSWORD;
    const pgDatabases = ['zenzers', 'medical_db', 'keycloak'];

    for (const dbName of pgDatabases) {
      // Support both new (per-db) and legacy (single file) formats
      let pgDumpFile = path.join(backupDir, `pg_dump_${dbName}.sql`);
      if (!fs.existsSync(pgDumpFile) && dbName === 'keycloak') {
        pgDumpFile = path.join(backupDir, 'pg_dump.sql'); // legacy fallback
      }
      if (!fs.existsSync(pgDumpFile)) continue;

      const args = ['-h', host, '-p', '5432', '-U', pgUser, '-d', dbName, '-f', pgDumpFile];
      logger.info(`Restoring PostgreSQL ${dbName} from ${pgDumpFile}`);
      await execFileAsync('psql', args, {
        timeout: 600_000,
        env: { ...process.env, PGPASSWORD: pgPassword || '' },
      });
    }

    await col.updateOne(
      { _id: new ObjectId(backupId) },
      { $set: { restoreStatus: 'completed' } },
    );

    // Audit log
    try {
      await db.collection('auditLog').insertOne({
        userId: restoredBy,
        action: 'backup:restored',
        resourceType: 'database-backup',
        resourceId: backupId,
        timestamp: new Date(),
        details: { backupName: backup.name, backupDate: backup.createdAt },
      });
    } catch {
      // Non-fatal
    }

    logger.info(`Restore from backup ${backupId} completed`);
  } catch (err: any) {
    await col.updateOne(
      { _id: new ObjectId(backupId) },
      { $set: { restoreStatus: 'failed', restoreError: err.message } },
    ).catch(() => {});

    logger.error(`Restore from backup ${backupId} failed: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Delete Backup Files
// ---------------------------------------------------------------------------

/**
 * Delete backup files from disk.
 */
export function deleteBackupFiles(backupPath: string): void {
  if (!backupPath || !backupPath.startsWith(BACKUPS_ROOT)) {
    logger.warn(`Refusing to delete path outside backups root: ${backupPath}`);
    return;
  }

  try {
    fs.rmSync(backupPath, { recursive: true, force: true });
    logger.info(`Deleted backup files at ${backupPath}`);
  } catch (err: any) {
    logger.error(`Failed to delete backup files at ${backupPath}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  executeBackup,
  restoreFromBackup,
  deleteBackupFiles,
  calculateDirSize,
  countBsonFiles,
};
