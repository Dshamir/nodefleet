import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
})

const bucket = process.env.S3_BUCKET || 'nodefleet'

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
    console.error('S3 upload error:', error)
    throw new Error('Failed to upload file')
  }
}

export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    const url = await getSignedUrl(s3Client, command, { expiresIn })

    return url
  } catch (error) {
    console.error('S3 presigned URL error:', error)
    throw new Error('Failed to generate presigned URL')
  }
}

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
    console.error('S3 presigned upload URL error:', error)
    throw new Error('Failed to generate presigned upload URL')
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    await s3Client.send(command)
  } catch (error) {
    console.error('S3 delete error:', error)
    throw new Error('Failed to delete file')
  }
}

// Aliases for backward compatibility
export const getPresignedDownloadUrl = getPresignedUrl
export const generatePresignedUrl = getPresignedUploadUrl

export { s3Client }
