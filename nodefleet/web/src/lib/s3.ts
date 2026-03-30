import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createLogger } from './logger'

const logger = createLogger('s3')

/**
 * Pre-configured S3 client instance.
 * Uses `AWS_REGION`, `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, and
 * `AWS_SECRET_ACCESS_KEY` environment variables. Path-style access
 * is enabled for MinIO/local S3-compatible stores.
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
})

const bucket = process.env.S3_BUCKET || 'nodefleet'

/**
 * Uploads a file to S3 and returns the public URL.
 * Converts string bodies to Buffer automatically.
 * @param key - S3 object key (e.g. `"uploads/firmware/v1.0.bin"`)
 * @param body - File contents as a Buffer or string
 * @param contentType - MIME type of the file (e.g. `"application/octet-stream"`)
 * @returns Public URL of the uploaded object
 * @throws Error if the upload fails
 */
export async function uploadFile(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  try {
    const buffer = typeof body === 'string' ? Buffer.from(body) : body

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })

    await s3Client.send(command)

    return `${process.env.S3_ENDPOINT}/${bucket}/${key}`
  } catch (error) {
    logger.error('S3 upload error', { error: String(error) })
    throw new Error('Failed to upload file')
  }
}

/**
 * Generates a presigned download URL for an S3 object.
 * If `S3_PUBLIC_ENDPOINT` is configured, the internal Docker hostname
 * in the URL is rewritten to the public endpoint for browser access.
 * @param key - S3 object key to generate a URL for
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 * @returns Presigned GET URL
 * @throws Error if URL generation fails
 */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    let url = await getSignedUrl(s3Client, command, { expiresIn })

    // Rewrite internal Docker hostname to public endpoint for browser access
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT
    const internalEndpoint = process.env.S3_ENDPOINT
    if (publicEndpoint && internalEndpoint) {
      url = url.replace(internalEndpoint, publicEndpoint)
    }

    return url
  } catch (error) {
    logger.error('S3 presigned URL error', { error: String(error) })
    throw new Error('Failed to generate presigned URL')
  }
}

/**
 * Generates a presigned upload URL that allows clients to PUT an object
 * directly to S3 without routing the file through the server.
 * @param key - S3 object key for the upload destination
 * @param contentType - Expected MIME type of the upload
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 * @returns Presigned PUT URL
 * @throws Error if URL generation fails
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })

    const url = await getSignedUrl(s3Client, command, { expiresIn })

    return url
  } catch (error) {
    logger.error('S3 presigned upload URL error', { error: String(error) })
    throw new Error('Failed to generate presigned upload URL')
  }
}

/**
 * Deletes an object from S3 by key.
 * @param key - S3 object key to delete
 * @throws Error if the deletion fails
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    await s3Client.send(command)
  } catch (error) {
    logger.error('S3 delete error', { error: String(error) })
    throw new Error('Failed to delete file')
  }
}

/** @deprecated Use {@link getPresignedUrl} instead. Alias kept for backward compatibility. */
export const getPresignedDownloadUrl = getPresignedUrl

/** @deprecated Use {@link getPresignedUploadUrl} instead. Alias kept for backward compatibility. */
export const generatePresignedUrl = getPresignedUploadUrl

export { s3Client }
