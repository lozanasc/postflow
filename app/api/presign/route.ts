import { NextRequest, NextResponse } from "next/server"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { wasabi, WASABI_BUCKET } from "@/lib/wasabi"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 })
  }

  const expiresIn = parseInt(searchParams.get("expiresIn") || "7200", 10) // default 2 hours, matches user example

  const command = new GetObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
  })

  const url = await getSignedUrl(wasabi, command, { expiresIn })

  return NextResponse.json({ url })
}
