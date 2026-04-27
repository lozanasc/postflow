import { S3Client } from "@aws-sdk/client-s3"

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
