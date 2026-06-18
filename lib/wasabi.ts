import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const wasabi = new S3Client({
  endpoint: process.env.WASABI_ENDPOINT!,
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY!,
    secretAccessKey: process.env.WASABI_SECRET_KEY!,
  },
  forcePathStyle: true,
})

export const WASABI_BUCKET = process.env.WASABI_BUCKET!

/**
 * Generate a presigned GET URL for viewing/downloading an object.
 * This works even if the bucket does not allow public access.
 */
export async function getWasabiPresignedUrl(key: string, expiresIn = 3600 * 24): Promise<string> {
  const bucket = WASABI_BUCKET
  const cleanKey = key.replace(/^\/+/, "")

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: cleanKey,
  })

  return getSignedUrl(wasabi, command, { expiresIn })
}

/**
 * @deprecated Use getWasabiPresignedUrl for viewing. Kept for legacy references.
 */
export function getWasabiPublicUrl(key: string): string {
  const bucket = WASABI_BUCKET
  const cleanKey = key.replace(/^\/+/, "")
  return `https://s3.wasabisys.com/${bucket}/${cleanKey}`
}
