import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { approved } = await req.json()

  // Ensure the clip belongs to the user
  const clip = await db.clip.findFirst({
    where: { id },
    include: { job: { select: { userId: true } } },
  })
  if (!clip || clip.job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await db.clip.update({ where: { id }, data: { approved } })
  return NextResponse.json(updated)
}
