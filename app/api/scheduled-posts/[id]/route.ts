import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { caption, scheduledAt, platform, status, socialAccountId } = await req.json()

  // Ensure ownership
  const existing = await db.scheduledPost.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await db.scheduledPost.update({
    where: { id },
    data: {
      caption: caption !== undefined ? (caption?.trim() ?? "") : existing.caption,
      scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : existing.scheduledAt,
      platform: platform || existing.platform,
      status: status || existing.status,
      socialAccountId: socialAccountId !== undefined ? socialAccountId : existing.socialAccountId,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await db.scheduledPost.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await db.scheduledPost.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
