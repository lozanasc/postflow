import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { wasabi, WASABI_BUCKET } from "@/lib/wasabi"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { randomUUID } from "crypto"

// Returns a presigned PUT URL so the client can upload directly to Wasabi
// without the file passing through our Next.js server.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { filename, contentType } = await req.json()
  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 })
  }

  const key = `uploads/${session.user.id}/${randomUUID()}-${filename}`

  const url = await getSignedUrl(
    wasabi,
    new PutObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 14400 }, // 4 hours for large file uploads
  )

  return NextResponse.json({ url, key })
}
